import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'checking' | 'ok' | 'error';

interface Check {
  name: string;
  fn: string;
  body?: any;
  description: string;
}

const CHECKS: Check[] = [
  { name: 'Finance Chat', fn: 'finance-chat', body: { messages: [{ role: 'user', content: 'ping' }] }, description: 'Streaming finance assistant' },
  { name: 'AI Insights', fn: 'ai-insights', body: { messages: [{ role: 'user', content: 'ping' }] }, description: 'Portfolio & finance advisor' },
  { name: 'Market Quotes', fn: 'market-quotes', body: { symbols: ['AAPL'] }, description: 'Live stock quotes' },
  { name: 'Exchange Rates', fn: 'exchange-rates', description: 'Currency conversion rates' },
  { name: 'Price Alerts', fn: 'check-price-alerts', description: 'Background alert checker' },
];

interface Result { status: Status; latency?: number; error?: string }

export const HealthCheckPanel = () => {
  const [results, setResults] = useState<Record<string, Result>>({});

  const runOne = useCallback(async (c: Check) => {
    setResults((r) => ({ ...r, [c.fn]: { status: 'checking' } }));
    const start = performance.now();
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${c.fn}${c.body ? '' : '?base=USD'}`;
      const resp = await fetch(url, {
        method: c.body ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: c.body ? JSON.stringify(c.body) : undefined,
      });
      const latency = Math.round(performance.now() - start);
      // Cancel streaming bodies after first chunk to free resource.
      try { await resp.body?.cancel(); } catch { /* noop */ }
      if (!resp.ok && resp.status !== 200) {
        setResults((r) => ({ ...r, [c.fn]: { status: 'error', latency, error: `HTTP ${resp.status}` } }));
      } else {
        setResults((r) => ({ ...r, [c.fn]: { status: 'ok', latency } }));
      }
    } catch (e: any) {
      const latency = Math.round(performance.now() - start);
      setResults((r) => ({ ...r, [c.fn]: { status: 'error', latency, error: e?.message ?? 'Network error' } }));
    }
  }, []);

  const runAll = useCallback(() => { CHECKS.forEach(runOne); }, [runOne]);

  useEffect(() => { runAll(); }, [runAll]);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Edge function health</CardTitle>
          <CardDescription>Live status of every backend service.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={runAll} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Re-check all
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {CHECKS.map((c) => {
          const r = results[c.fn] ?? { status: 'idle' as Status };
          return (
            <div key={c.fn} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                r.status === 'ok' && 'bg-emerald-500/10 text-emerald-600',
                r.status === 'error' && 'bg-destructive/10 text-destructive',
                (r.status === 'checking' || r.status === 'idle') && 'bg-muted text-muted-foreground',
              )}>
                {r.status === 'checking' && <Loader2 className="w-4 h-4 animate-spin" />}
                {r.status === 'ok' && <CheckCircle2 className="w-4 h-4" />}
                {r.status === 'error' && <XCircle className="w-4 h-4" />}
                {r.status === 'idle' && <Activity className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <code className="text-[11px] text-muted-foreground">{c.fn}</code>
                  {r.latency != null && r.status !== 'idle' && (
                    <Badge variant="secondary" className="text-[10px]">{r.latency}ms</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {r.status === 'error' ? <span className="text-destructive">{r.error}</span> : c.description}
                </p>
              </div>
              {r.status === 'error' && (
                <Button size="sm" variant="outline" onClick={() => runOne(c)} className="gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
