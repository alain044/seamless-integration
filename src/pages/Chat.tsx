import { useState, useRef, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, Loader2, Lock, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finance-chat`;
const ANON_FREE_LIMIT = 8;
const COUNT_KEY = "savvy_free_msg_count";

const formatReset = (ms: number) => {
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const SUGGESTIONS = [
  "How should I start investing with $1,000?",
  "Explain compound interest simply",
  "What's the difference between a Roth IRA and traditional IRA?",
  "How do I create a monthly budget?",
];

export default function Chat() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<{ msg: string; retry: () => void } | null>(null);
  const [anonCount, setAnonCount] = useState(() => Number(localStorage.getItem(COUNT_KEY) ?? "0"));
  const [dbUsage, setDbUsage] = useState<{ remaining: number; limit: number; reset_in_ms: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Context payload passed via location.state OR query params (dashboard CTA)
  const contextPayload = (location.state as any)?.context ?? (() => {
    const ctxParam = searchParams.get("context");
    if (!ctxParam) return null;
    try { return JSON.parse(decodeURIComponent(ctxParam)); } catch { return null; }
  })();

  useEffect(() => {
    if (contextPayload && messages.length === 0) {
      const summary = typeof contextPayload === 'string'
        ? contextPayload
        : `Context from dashboard:\n\`\`\`json\n${JSON.stringify(contextPayload, null, 2)}\n\`\`\``;
      setMessages([{ role: "assistant", content: `I have your dashboard context loaded.\n\n${summary}\n\nWhat would you like to know?` }]);
    }
  }, [contextPayload, messages.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Load DB-backed usage for signed-in users
  useEffect(() => {
    if (!user) { setDbUsage(null); return; }
    (async () => {
      const { data } = await supabase.functions.invoke('ai-usage-check', { body: { action: 'check' } });
      if (data) setDbUsage(data as any);
    })();
  }, [user]);

  const remaining = user
    ? (dbUsage ? dbUsage.remaining : Infinity)
    : Math.max(0, ANON_FREE_LIMIT - anonCount);
  const limit = user ? (dbUsage?.limit ?? null) : ANON_FREE_LIMIT;
  const limitReached = remaining === 0;

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    if (limitReached) {
      toast.error(user
        ? `Daily limit reached. Resets in ${formatReset(dbUsage?.reset_in_ms ?? 0)}.`
        : "Sign in to keep chatting with Savvy.");
      return;
    }

    const userMsg: Msg = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);
    setLastError(null);

    // Consume one credit
    if (user) {
      const { data, error } = await supabase.functions.invoke('ai-usage-check', { body: { action: 'consume' } });
      if (error || (data && data.allowed === false)) {
        setIsLoading(false);
        setDbUsage(data as any);
        toast.error(`Daily limit reached. Resets in ${formatReset((data as any)?.reset_in_ms ?? 0)}.`);
        return;
      }
      setDbUsage(data as any);
    } else {
      const next = anonCount + 1;
      setAnonCount(next);
      localStorage.setItem(COUNT_KEY, String(next));
    }

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages,
          context: contextPayload ?? undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to get response";
      console.error(e);
      setLastError({ msg, retry: () => sendMessage(text) });
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full pt-20 pb-4 px-4">
        {!user && (
          <div className="text-xs text-muted-foreground mb-2 text-center">
            Free preview · {remaining === Infinity ? '∞' : remaining} of {FREE_LIMIT} messages remaining ·{' '}
            <Link to="/auth" className="text-primary hover:underline">Sign in for unlimited</Link>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-20">
              <div className="gradient-primary rounded-2xl p-4">
                <Bot className="h-10 w-10 text-primary-foreground" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="font-heading text-2xl font-bold">Ask Savvy AI</h2>
                <p className="text-muted-foreground max-w-md">
                  Ask about finance, budgeting, or investments — I'm here to help!
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left text-sm px-4 py-3 rounded-xl border border-border hover:bg-secondary transition-colors text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="gradient-primary rounded-lg p-1.5 h-8 w-8 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "glass-card"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="bg-secondary rounded-lg p-1.5 h-8 w-8 flex items-center justify-center shrink-0 mt-1">
                  <User className="h-4 w-4 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="gradient-primary rounded-lg p-1.5 h-8 w-8 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="glass-card rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          {lastError && !isLoading && (
            <Alert variant="destructive">
              <AlertTitle>Couldn't reach Savvy</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-3">
                <span className="text-xs">{lastError.msg}</span>
                <Button size="sm" variant="outline" onClick={lastError.retry} className="gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {limitReached ? (
          <div className="rounded-2xl border border-border p-6 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">You've reached the free limit</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create a free account to keep chatting and unlock the full finance dashboard.
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button asChild className="gradient-primary text-primary-foreground border-0">
                <Link to="/auth?mode=signup">Create free account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 pt-2 border-t border-border">
            <Input
              placeholder="Ask about finance, budgeting, or investments..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="gradient-primary text-primary-foreground border-0 shadow-glow"
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
