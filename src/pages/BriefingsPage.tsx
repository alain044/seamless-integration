import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Headphones, Play, Pause, RotateCcw, SkipBack, SkipForward, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Briefing {
  id: string;
  title: string;
  description: string | null;
  audio_path: string;
  created_at: string;
  url?: string;
  recipientId: string;
  listened: boolean;
  completedAt: string | null;
  progressSeconds: number;
}

const fmt = (s: number) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60); const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
};

const Player = ({ b, onEvent }: {
  b: Briefing;
  onEvent: (type: string, position: number, extra?: Partial<Briefing>) => void;
}) => {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(b.progressSeconds || 0);
  const [dur, setDur] = useState(0);
  const playedOnce = useRef(b.listened);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleLoaded = () => {
      setDur(el.duration);
      if (b.progressSeconds && b.progressSeconds < el.duration - 1) {
        el.currentTime = b.progressSeconds;
      }
    };
    el.addEventListener('loadedmetadata', handleLoaded);
    return () => el.removeEventListener('loadedmetadata', handleLoaded);
  }, [b.progressSeconds]);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setPlaying(true);
      if (!playedOnce.current) {
        playedOnce.current = true;
        onEvent('first_play', el.currentTime);
      } else {
        onEvent('resume', el.currentTime);
      }
    } else {
      el.pause();
      setPlaying(false);
      onEvent('pause', el.currentTime);
    }
  };

  const seek = (v: number) => {
    const el = ref.current; if (!el) return;
    el.currentTime = v; setPos(v);
    onEvent('seek', v);
  };

  const skip = (delta: number) => {
    const el = ref.current; if (!el) return;
    el.currentTime = Math.max(0, Math.min(dur, el.currentTime + delta));
  };

  const replay = () => {
    const el = ref.current; if (!el) return;
    el.currentTime = 0; el.play();
    setPlaying(true);
    onEvent('replay', 0);
  };

  return (
    <div className="space-y-3">
      <audio
        ref={ref}
        src={b.url}
        onTimeUpdate={(e) => setPos((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => { setPlaying(false); onEvent('completed', dur, { completedAt: new Date().toISOString() }); }}
        onPause={() => setPlaying(false)}
      />
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => skip(-15)}><SkipBack className="w-4 h-4" /></Button>
        <Button size="icon" onClick={toggle}>{playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</Button>
        <Button size="icon" variant="ghost" onClick={() => skip(15)}><SkipForward className="w-4 h-4" /></Button>
        <Button size="icon" variant="ghost" onClick={replay}><RotateCcw className="w-4 h-4" /></Button>
        <span className="text-xs text-muted-foreground tabular-nums ml-2">{fmt(pos)} / {fmt(dur)}</span>
        {b.completedAt && <span className="ml-auto text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</span>}
      </div>
      <Slider value={[pos]} max={dur || 1} step={1} onValueChange={(v) => seek(v[0])} />
    </div>
  );
};

const BriefingsPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Briefing[]>([]);

  const load = async () => {
    if (!user) return;
    const { data: recipients } = await supabase
      .from('audio_briefing_recipients')
      .select('id, listened_at, completed_at, progress_seconds, briefing:audio_briefings(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    const list: Briefing[] = [];
    for (const r of (recipients || []) as any[]) {
      if (!r.briefing) continue;
      const { data: signed } = await supabase.storage.from('briefings').createSignedUrl(r.briefing.audio_path, 3600);
      list.push({
        ...r.briefing,
        url: signed?.signedUrl,
        recipientId: r.id,
        listened: !!r.listened_at,
        completedAt: r.completed_at,
        progressSeconds: Number(r.progress_seconds || 0),
      });
    }
    setItems(list);
  };

  useEffect(() => { load(); }, [user]);

  const recordEvent = async (b: Briefing, type: string, position: number, extra?: Partial<Briefing>) => {
    if (!user) return;
    await supabase.from('briefing_events').insert({
      briefing_id: b.id, user_id: user.id, event_type: type, position_seconds: position,
    });
    const updates: any = { last_played_at: new Date().toISOString(), progress_seconds: position };
    if (type === 'first_play') { updates.first_played_at = new Date().toISOString(); updates.listened_at = updates.listened_at ?? new Date().toISOString(); }
    if (type === 'completed') { updates.completed_at = new Date().toISOString(); }
    await supabase.from('audio_briefing_recipients').update(updates).eq('id', b.recipientId);
    if (extra?.completedAt) {
      setItems((prev) => prev.map((i) => i.recipientId === b.recipientId ? { ...i, completedAt: updates.completed_at } : i));
      toast.success('Briefing completed');
    }
    if (type === 'first_play') {
      setItems((prev) => prev.map((i) => i.recipientId === b.recipientId ? { ...i, listened: true } : i));
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Headphones className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Audio Briefings</h1>
          <p className="text-sm text-muted-foreground">Messages from your organization owner</p>
        </div>
      </div>

      {items.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No briefings yet.</CardContent></Card>
      )}

      {items.map((b) => (
        <Card key={b.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {b.title}
              {!b.listened && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">New</span>}
            </CardTitle>
            {b.description && <p className="text-sm text-muted-foreground">{b.description}</p>}
          </CardHeader>
          <CardContent>
            {b.url ? <Player b={b} onEvent={(t, p, ex) => recordEvent(b, t, p, ex)} /> : <p className="text-sm text-muted-foreground">Audio unavailable.</p>}
            <p className="text-xs text-muted-foreground mt-3">{new Date(b.created_at).toLocaleString()}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default BriefingsPage;
