const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are SavvyAI Finance Assistant — a concise, expert AI for finance, investing, budgeting, accounting, taxes, economics, banking, insurance, and real-estate finance.

Style rules (very important):
- Be direct and specific. No filler, no hedging openings, no recaps of the question.
- Lead with the answer in 1–2 sentences, then up to 3 short bullets if needed.
- Skip jargon unless asked; if used, define inline.
- Add a one-line "⚠️ Educational, not personalized advice." footer ONLY when giving investment advice.
- Politely refuse anything off-topic (non-finance) in a single sentence.`;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json().catch(() => ({ messages: [] }));
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages array required" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const systemMessages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];
    if (context) {
      systemMessages.push({
        role: "system",
        content: `User dashboard context (use to personalize answers):\n${typeof context === "string" ? context : JSON.stringify(context)}`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [...systemMessages, ...messages],
        stream: true,
      }),
    });

    if (response.status === 429) return json({ error: "Rate limit exceeded. Please try again shortly." }, 429);
    if (response.status === 402) return json({ error: "AI credits exhausted. Add credits in Lovable Cloud settings." }, 402);
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return json({ error: `AI service error (${response.status})` }, 502);
    }

    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("finance-chat error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
