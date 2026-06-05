import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Mic, Square, Upload, Send, Trash2, Headphones, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Member { user_id: string; full_name: string | null; email: string | null; }
interface Briefing { id: string; title: string; created_at: string; audio_path: string; }
interface Recipient { id: string; user_id: string; listened_at: string | null; first_played_at: string | null; completed_at: string | null; progress_seconds: number; }

export const BriefingComposer = () => {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Record<string, Recipient[]>>({});
  const mediaRef = useState<MediaRecorder | null>(null)[0] as any;
  const chunksRef: { current: Blob[] } = { current: [] };

  const memberLabel = (uid: string) => {
    const m = members.find((x) => x.user_id === uid);
    return m?.full_name || m?.email || uid.slice(0, 8);
  };

  const refresh = async () => {
    if (!organization) return;
    const { data: br } = await supabase
      .from('audio_briefings').select('id, title, created_at, audio_path')
      .eq('organization_id', organization.id).order('created_at', { ascending: false });
    setBriefings((br || []) as Briefing[]);
  };

  useEffect(() => {
    if (!organization) return;
    (async () => {
      const { data: mems } = await supabase
        .from('organization_members').select('user_id')
        .eq('organization_id', organization.id);
      const ids = (mems || []).map((m: any) => m.user_id).filter((id: string) => id !== user?.id);
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
        setMembers((profs || []) as Member[]);
      }
      await refresh();
    })();
  }, [organization, user]);

  const loadRecipients = async (briefingId: string) => {
    if (recipients[briefingId]) { setExpanded(expanded === briefingId ? null : briefingId); return; }
    const { data } = await supabase.from('audio_briefing_recipients')
      .select('id, user_id, listened_at, first_played_at, completed_at, progress_seconds')
      .eq('briefing_id', briefingId);
    setRecipients((prev) => ({ ...prev, [briefingId]: (data || []) as Recipient[] }));
    setExpanded(briefingId);
  };

  const recorderRef: { current: MediaRecorder | null } = { current: null };

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioPreview(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      recorderRef.current = mr;
      setRecording(true);
    } catch {
      toast.error('Microphone access denied');
    }
  };
  const stopRecord = () => { recorderRef.current?.stop(); setRecording(false); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setAudioBlob(f); setAudioPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!title.trim() || !audioBlob || !organization || !user) { toast.error('Title, audio, and recipients required'); return; }
    if (selected.size === 0) { toast.error('Select at least one recipient'); return; }
    setSending(true);
    try {
      const ext = audioBlob.type.includes('mp3') ? 'mp3' : audioBlob.type.includes('wav') ? 'wav' : 'webm';
      const path = `${organization.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('briefings').upload(path, audioBlob, { contentType: audioBlob.type });
      if (upErr) throw upErr;
      const { data: br, error: brErr } = await supabase.from('audio_briefings')
        .insert({ organization_id: organization.id, owner_id: user.id, title: title.trim(), description: description.trim() || null, audio_path: path })
        .select('id').single();
      if (brErr) throw brErr;
      const rows = Array.from(selected).map((uid) => ({ briefing_id: br.id, user_id: uid }));
      const { error: rErr } = await supabase.from('audio_briefing_recipients').insert(rows);
      if (rErr) throw rErr;
      await supabase.from('notifications').insert(
        Array.from(selected).map((uid) => ({
          user_id: uid, title: 'New audio briefing', message: title.trim(), type: 'info', link: '/dashboard/briefings',
        })),
      );
      await supabase.from('briefing_events').insert(
        Array.from(selected).map((uid) => ({ briefing_id: br.id, user_id: uid, event_type: 'assigned' })),
      );
      toast.success(`Briefing sent to ${selected.size} member(s)`);
      setTitle(''); setDescription(''); setAudioBlob(null); setAudioPreview(null); setSelected(new Set());
      await refresh();
    } catch (e: any) {
      toast.error(e.message || 'Failed to send');
    } finally { setSending(false); }
  };

  const remove = async (b: Briefing) => {
    if (!confirm(`Delete briefing "${b.title}"?`)) return;
    await supabase.storage.from('briefings').remove([b.audio_path]);
    await supabase.from('audio_briefings').delete().eq('id', b.id);
    setBriefings((prev) => prev.filter((x) => x.id !== b.id));
  };

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Headphones className="w-5 h-5 text-primary" /> Voice Briefing Center</CardTitle>
        <CardDescription>Record or upload an audio briefing, assign to members, and track delivery & playback.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly update" />
        </div>
        <div className="space-y-2">
          <Label>Description (optional)</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {!recording ? (
            <Button type="button" variant="outline" onClick={startRecord}><Mic className="w-4 h-4 mr-2" /> Record</Button>
          ) : (
            <Button type="button" variant="destructive" onClick={stopRecord}><Square className="w-4 h-4 mr-2" /> Stop</Button>
          )}
          <Button type="button" variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="w-4 h-4 mr-2" /> Upload audio
              <input type="file" accept="audio/*" className="hidden" onChange={handleFile} />
            </label>
          </Button>
          {audioPreview && (
            <Button type="button" variant="ghost" onClick={() => { setAudioBlob(null); setAudioPreview(null); }}>
              <Trash2 className="w-4 h-4 mr-2" /> Clear
            </Button>
          )}
        </div>
        {audioPreview && <audio src={audioPreview} controls className="w-full" />}

        <div className="space-y-2">
          <Label>Recipients</Label>
          {members.length === 0 && <p className="text-sm text-muted-foreground">No other members to send to.</p>}
          <div className="space-y-1 max-h-48 overflow-y-auto rounded border border-border p-2">
            {members.map((m) => (
              <label key={m.user_id} className="flex items-center gap-2 p-1.5 hover:bg-accent rounded cursor-pointer">
                <Checkbox checked={selected.has(m.user_id)} onCheckedChange={() => toggle(m.user_id)} />
                <span className="text-sm">{m.full_name || m.email || m.user_id.slice(0, 8)}</span>
              </label>
            ))}
          </div>
        </div>

        <Button onClick={submit} disabled={sending || !audioBlob || !title.trim() || selected.size === 0} className="w-full">
          <Send className="w-4 h-4 mr-2" /> {sending ? 'Sending...' : 'Send Briefing'}
        </Button>

        {briefings.length > 0 && (
          <div className="pt-4 border-t border-border space-y-2">
            <Label>Sent briefings</Label>
            {briefings.map((b) => (
              <div key={b.id} className="rounded border border-border">
                <div className="flex items-center justify-between p-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{b.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => loadRecipients(b.id)}>
                      <Users className="w-4 h-4 mr-1" /> Shared with
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(b)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                {expanded === b.id && (
                  <div className="border-t border-border p-2 space-y-1">
                    {(recipients[b.id] || []).map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs">
                        <span>{memberLabel(r.user_id)}</span>
                        <div className="flex gap-1">
                          <Badge variant={r.first_played_at ? 'default' : 'secondary'}>{r.first_played_at ? 'Played' : 'Delivered'}</Badge>
                          {r.completed_at && <Badge>Completed</Badge>}
                        </div>
                      </div>
                    ))}
                    {(recipients[b.id] || []).length === 0 && <p className="text-xs text-muted-foreground">No recipients.</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
