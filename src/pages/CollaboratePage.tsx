import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessagesSquare, Plus, Send, Hash, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type Status = 'open' | 'in_progress' | 'pending_review' | 'resolved' | 'closed';
const STATUS_LABEL: Record<Status, string> = {
  open: 'Open', in_progress: 'In Progress', pending_review: 'Pending Review', resolved: 'Resolved', closed: 'Closed',
};
const STATUS_VARIANT: Record<Status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  open: 'destructive', in_progress: 'default', pending_review: 'secondary', resolved: 'outline', closed: 'outline',
};

interface Case { id: string; title: string; description: string | null; status: Status; priority: string; created_by: string; created_at: string; }
interface Msg { id: string; case_id: string; user_id: string; body: string; created_at: string; parent_message_id?: string | null; mentions?: string[] }
interface ChatMsg { id: string; user_id: string; body: string; created_at: string; }

const CasesTab = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [cases, setCases] = useState<Case[]>([]);
  const [active, setActive] = useState<Case | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [newCase, setNewCase] = useState({ title: '', description: '', priority: 'normal' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reply, setReply] = useState('');
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [search, setSearch] = useState('');
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [members, setMembers] = useState<Array<{ user_id: string; full_name: string | null; email: string | null }>>([]);

  useEffect(() => {
    if (!organization) return;
    (async () => {
      const { data: mems } = await supabase.from('organization_members')
        .select('user_id').eq('organization_id', organization.id);
      const ids = (mems || []).map((m: any) => m.user_id);
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles')
          .select('user_id, full_name, email').in('user_id', ids);
        setMembers((profs || []) as any);
      }
    })();
  }, [organization?.id]);

  const loadProfiles = async (ids: string[]) => {
    const missing = ids.filter((id) => !profiles[id]);
    if (!missing.length) return;
    const { data } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', missing);
    const map: typeof profiles = {};
    (data || []).forEach((p: any) => { map[p.user_id] = { full_name: p.full_name, email: p.email }; });
    setProfiles((prev) => ({ ...prev, ...map }));
  };

  useEffect(() => {
    if (!organization) return;
    (async () => {
      const { data } = await supabase.from('collab_cases').select('*')
        .eq('organization_id', organization.id).order('created_at', { ascending: false });
      const list = (data || []) as Case[];
      setCases(list);
      await loadProfiles(list.map((c) => c.created_by));
    })();
    const ch = supabase.channel(`cases-${organization.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collab_cases', filter: `organization_id=eq.${organization.id}` }, (p) => {
        if (p.eventType === 'INSERT') setCases((prev) => [p.new as Case, ...prev]);
        if (p.eventType === 'UPDATE') setCases((prev) => prev.map((c) => c.id === (p.new as Case).id ? p.new as Case : c));
        if (p.eventType === 'DELETE') setCases((prev) => prev.filter((c) => c.id !== (p.old as Case).id));
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [organization?.id]);

  useEffect(() => {
    if (!active) return;
    (async () => {
      const { data } = await supabase.from('collab_case_messages').select('*').eq('case_id', active.id).order('created_at');
      const list = (data || []) as Msg[];
      setMsgs(list);
      await loadProfiles(list.map((m) => m.user_id));
    })();
    const ch = supabase.channel(`case-msgs-${active.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'collab_case_messages', filter: `case_id=eq.${active.id}` }, async (p) => {
        const m = p.new as Msg;
        setMsgs((prev) => [...prev, m]);
        await loadProfiles([m.user_id]);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active?.id]);

  const createCase = async () => {
    if (!user || !organization || !newCase.title.trim()) return;
    const { data, error } = await supabase.from('collab_cases').insert({
      organization_id: organization.id, created_by: user.id,
      title: newCase.title.trim(), description: newCase.description.trim() || null,
      priority: newCase.priority, status: 'open',
    }).select().single();
    if (error) { toast.error(error.message); return; }
    setActive(data as Case);
    setNewCase({ title: '', description: '', priority: 'normal' });
    setDialogOpen(false);
    toast.success('Case created');
  };

  const updateStatus = async (s: Status) => {
    if (!active) return;
    const { data, error } = await supabase.from('collab_cases').update({ status: s }).eq('id', active.id).select().single();
    if (error) { toast.error(error.message); return; }
    setActive(data as Case);
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !active || !reply.trim()) return;
    const body = reply.trim();
    // Extract @mentions: match @name to a member's full_name or email
    const mentionMatches = Array.from(body.matchAll(/@([\w.@-]+)/g)).map((m) => m[1].toLowerCase());
    const mentionIds = members
      .filter((m) => {
        const hay = `${m.full_name ?? ''} ${m.email ?? ''}`.toLowerCase();
        return mentionMatches.some((q) => hay.includes(q));
      })
      .map((m) => m.user_id);
    setReply(''); const parent = replyTo?.id ?? null; setReplyTo(null);
    const { error } = await supabase.from('collab_case_messages').insert({
      case_id: active.id, user_id: user.id, body,
      mentions: mentionIds, parent_message_id: parent,
    } as any);
    if (error) toast.error(error.message);
  };

  const filteredCases = cases.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q);
  });

  const label = (uid: string) => profiles[uid]?.full_name || profiles[uid]?.email || uid.slice(0, 8);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-12rem)]">
      <Card className="md:col-span-1 overflow-y-auto">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Cases</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4" /></Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New collaboration case</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Title" value={newCase.title} onChange={(e) => setNewCase((p) => ({ ...p, title: e.target.value }))} />
                <Textarea placeholder="Describe the situation, issue, or request" value={newCase.description} onChange={(e) => setNewCase((p) => ({ ...p, description: e.target.value }))} />
                <Select value={newCase.priority} onValueChange={(v) => setNewCase((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={createCase} className="w-full">Create case</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search discussions…" className="mb-2 h-8 text-xs" />
          {filteredCases.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {search ? 'No matches.' : 'No cases yet.'}
            </p>
          )}
          {filteredCases.map((c) => (
            <button key={c.id} onClick={() => setActive(c)}
              className={`w-full text-left p-2 rounded border ${active?.id === c.id ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'}`}>
              <p className="text-sm font-medium truncate">{c.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={STATUS_VARIANT[c.status]} className="text-[10px]">{STATUS_LABEL[c.status]}</Badge>
                <span className="text-[10px] text-muted-foreground">{label(c.created_by)}</span>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="md:col-span-2 flex flex-col overflow-hidden">
        {!active ? (
          <CardContent className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select or create a case to begin.
          </CardContent>
        ) : (
          <>
            <CardHeader className="border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{active.title}</CardTitle>
                  {active.description && <p className="text-xs text-muted-foreground mt-1">{active.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Opened by {label(active.created_by)} · {new Date(active.created_at).toLocaleString()}</p>
                </div>
                <Select value={active.status} onValueChange={(v) => updateStatus(v as Status)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3 py-4">
              {msgs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No replies yet.</p>}
              {msgs.map((m) => {
                const mine = m.user_id === user?.id;
                const parent = m.parent_message_id ? msgs.find((x) => x.id === m.parent_message_id) : null;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {!mine && <p className="text-[10px] font-medium opacity-70 mb-0.5">{label(m.user_id)}</p>}
                      {parent && (
                        <div className={`text-[10px] mb-1 pl-2 border-l-2 ${mine ? 'border-primary-foreground/40 opacity-80' : 'border-primary/40'}`}>
                          <span className="font-medium">{label(parent.user_id)}: </span>
                          <span className="opacity-80">{parent.body.slice(0, 80)}{parent.body.length > 80 ? '…' : ''}</span>
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className={`text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <button type="button" onClick={() => setReplyTo(m)}
                          className={`text-[10px] underline-offset-2 hover:underline ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
            {replyTo && (
              <div className="border-t border-border px-3 py-1.5 bg-muted/30 flex items-center justify-between text-xs">
                <span className="truncate">Replying to <strong>{label(replyTo.user_id)}</strong>: {replyTo.body.slice(0, 60)}</span>
                <button type="button" onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground ml-2">✕</button>
              </div>
            )}
            <form onSubmit={sendReply} className="border-t border-border p-3 flex gap-2">
              <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply… use @ to mention" />
              <Button type="submit" disabled={!reply.trim()}><Send className="w-4 h-4" /></Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
};

const ChatTab = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null }>>({});

  const loadProfiles = async (ids: string[]) => {
    const missing = ids.filter((i) => !profiles[i]);
    if (!missing.length) return;
    const { data } = await supabase.from('profiles').select('user_id, full_name').in('user_id', missing);
    const m: typeof profiles = {};
    (data || []).forEach((p: any) => { m[p.user_id] = { full_name: p.full_name }; });
    setProfiles((prev) => ({ ...prev, ...m }));
  };

  useEffect(() => {
    if (!organization) return;
    (async () => {
      const { data } = await supabase.from('org_messages').select('*')
        .eq('organization_id', organization.id).order('created_at').limit(200);
      const list = (data || []) as ChatMsg[];
      setMessages(list);
      await loadProfiles(list.map((m) => m.user_id));
    })();
    const ch = supabase.channel(`org-msgs-${organization.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'org_messages', filter: `organization_id=eq.${organization.id}` }, async (p) => {
        const m = p.new as ChatMsg;
        setMessages((prev) => [...prev, m]);
        await loadProfiles([m.user_id]);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [organization?.id]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !organization || !text.trim()) return;
    const body = text.trim(); setText('');
    await supabase.from('org_messages').insert({ organization_id: organization.id, user_id: user.id, body });
  };

  return (
    <Card className="h-[calc(100vh-12rem)] flex flex-col">
      <CardHeader className="border-b border-border"><CardTitle className="text-base flex items-center gap-2"><Hash className="w-4 h-4" /> General</CardTitle></CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-3 py-4">
        {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">No messages yet.</p>}
        {messages.map((m) => {
          const mine = m.user_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {!mine && <p className="text-[10px] font-medium opacity-70 mb-0.5">{profiles[m.user_id]?.full_name || 'Member'}</p>}
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
      <form onSubmit={send} className="border-t border-border p-3 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the team…" />
        <Button type="submit" disabled={!text.trim()}><Send className="w-4 h-4" /></Button>
      </form>
    </Card>
  );
};

const CollaboratePage = () => {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <MessagesSquare className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Collaboration Center</h1>
          <p className="text-sm text-muted-foreground">Raise situations, assign work, and chat with your team.</p>
        </div>
      </div>
      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="chat">Team chat</TabsTrigger>
        </TabsList>
        <TabsContent value="cases" className="mt-4"><CasesTab /></TabsContent>
        <TabsContent value="chat" className="mt-4"><ChatTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default CollaboratePage;
