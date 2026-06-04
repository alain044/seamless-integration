import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface Msg {
  id: string;
  organization_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: { full_name: string | null; avatar_url: string | null };
}

const CollaboratePage = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadProfiles = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    const missing = userIds.filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', missing);
    if (data) {
      const map: typeof profiles = {};
      data.forEach((p: any) => { map[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url }; });
      setProfiles((prev) => ({ ...prev, ...map }));
    }
  };

  useEffect(() => {
    if (!organization) return;
    (async () => {
      const { data, error } = await supabase
        .from('org_messages')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) { toast.error(error.message); return; }
      const list = (data || []) as Msg[];
      setMessages(list);
      await loadProfiles([...new Set(list.map((m) => m.user_id))]);
    })();

    const channel = supabase
      .channel(`org-msgs-${organization.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'org_messages', filter: `organization_id=eq.${organization.id}` }, async (payload) => {
        const m = payload.new as Msg;
        setMessages((prev) => [...prev, m]);
        await loadProfiles([m.user_id]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !user || !organization) return;
    setText('');
    const { error } = await supabase.from('org_messages').insert({ organization_id: organization.id, user_id: user.id, body });
    if (error) toast.error(error.message);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <MessagesSquare className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Collaborate</h1>
          <p className="text-sm text-muted-foreground">Realtime channel for {organization?.name}</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 space-y-3">
        {messages.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">No messages yet. Say hello.</p>}
        {messages.map((m) => {
          const mine = m.user_id === user?.id;
          const author = profiles[m.user_id];
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {!mine && <p className="text-xs font-medium opacity-70 mb-0.5">{author?.full_name || 'Member'}</p>}
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <form onSubmit={send} className="flex gap-2 mt-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." className="flex-1" />
        <Button type="submit" disabled={!text.trim()}><Send className="w-4 h-4" /></Button>
      </form>
    </div>
  );
};

export default CollaboratePage;
