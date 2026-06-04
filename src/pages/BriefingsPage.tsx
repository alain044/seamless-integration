import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Headphones, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Briefing {
  id: string;
  title: string;
  description: string | null;
  audio_path: string;
  created_at: string;
}

const BriefingsPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<(Briefing & { url?: string; listened?: boolean; recipientId?: string })[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: recipients } = await supabase
        .from('audio_briefing_recipients')
        .select('id, listened_at, briefing:audio_briefings(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      const list: any[] = [];
      for (const r of (recipients || []) as any[]) {
        if (!r.briefing) continue;
        const { data: signed } = await supabase.storage.from('briefings').createSignedUrl(r.briefing.audio_path, 3600);
        list.push({ ...r.briefing, url: signed?.signedUrl, listened: !!r.listened_at, recipientId: r.id });
      }
      setItems(list);
    })();
  }, [user]);

  const markListened = async (recipientId: string) => {
    await supabase.from('audio_briefing_recipients').update({ listened_at: new Date().toISOString() }).eq('id', recipientId);
    setItems((prev) => prev.map((i) => i.recipientId === recipientId ? { ...i, listened: true } : i));
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
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-primary" />
              {b.title}
              {!b.listened && <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">New</span>}
            </CardTitle>
            {b.description && <p className="text-sm text-muted-foreground">{b.description}</p>}
          </CardHeader>
          <CardContent>
            {b.url ? (
              <audio
                src={b.url}
                controls
                className="w-full"
                onPlay={() => { if (!b.listened && b.recipientId) markListened(b.recipientId); }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Audio unavailable.</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">{new Date(b.created_at).toLocaleString()}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default BriefingsPage;
