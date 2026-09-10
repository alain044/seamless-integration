import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Activity, Clock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EDGE_FUNCTIONS, probeableFunctions, type EdgeFunctionSpec } from '@/lib/edgeFunctions';

type Status = 'idle' | 'checking' | 'ok' | 'error' | 'skipped';

interface Result { status: Status; latency?: number; error?: string; note?: string }

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const HealthCheckPanel = () => {
  const [results, setResults] = useState<Record<string, Result>>({});
  const probeable = useMemo(() => probeableFunctions(), []);

  const runOne = useCallback(async (fn: EdgeFunctionSpec) => {
    const probe = fn.probe;
    if (!probe) {
      setResults((r) => ({ ...r, [fn.name]: { status: 'skipped', note: fn.scheduledReason } }));
      return;
    }

    setResults((r) => ({ ...r, [fn.name]: { status: 'checking' } }));
    const start = performance.now();

    try {
      // Always anonymous: auth-gated functions answer with a rejection, which is
      // the healthy signal. Sending a user session would run AI work and mutate data.
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn.name}${probe.query ?? ''}`, {
        method: probe.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON}`,
          apikey: ANON,
        },
        body: probe.body != null ? JSON.stringify(probe.body) : undefined,
      });

      const latency = Math.round(performance.now() - start);

      let note: string | undefined;
      let error: string | undefined;

      if (probe.expect.includes(resp.status)) {
        if (fn.requiresAuth) note = 'reachable — rejected the anonymous caller as expected';
      } else {
        try {
          const j = await resp.clone().json();
          error = j?.error || `HTTP ${resp.status}`;
        } catch {
          error = `HTTP ${resp.status}`;
        }
      }

      try { await resp.body?.cancel(); } catch { /* noop */ }

      setResults((r) => ({
        ...r,
        [fn.name]: error ? { status: 'error', latency, error } : { status: 'ok', latency, note },
      }));
    } catch (e: any) {
      const latency = Math.round(performance.now() - start);
      setResults((r) => ({ ...r, [fn.name]: { status: 'error', latency, error: e?.message ?? 'Network error' } }));
    }
  }, []);

  const runAll = useCallback(() => { probeable.forEach(runOne); }, [runOne, probeable]);

  useEffect(() => {
    runAll();
    setResults((r) => {
      const next = { ...r };
      for (const fn of EDGE_FUNCTIONS) {
        if (!fn.probe && !next[fn.name]) next[fn.name] = { status: 'skipped', note: fn.scheduledReason };
      }
      return next;
    });
  }, [runAll]);

  const healthy = probeable.filter((fn) => results[fn.name]?.status === 'ok').length;
  const failed = probeable.filter((fn) => results[fn.name]?.status === 'error').length;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Edge function health</CardTitle>
          <CardDescription>
            {failed === 0
              ? `${healthy}/${probeable.length} probed services healthy`
              : `${failed} of ${probeable.length} probed services failing`}
            {EDGE_FUNCTIONS.length > probeable.length && ` · ${EDGE_FUNCTIONS.length - probeable.length} scheduled, not probed`}
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={runAll} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Re-check all
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {EDGE_FUNCTIONS.map((c) => {
          const r = results[c.name] ?? { status: 'idle' as Status };
          return (
            <div key={c.name} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                r.status === 'ok' && 'bg-emerald-500/10 text-emerald-600',
                r.status === 'error' && 'bg-destructive/10 text-destructive',
                (r.status === 'checking' || r.status === 'idle') && 'bg-muted text-muted-foreground',
                r.status === 'skipped' && 'bg-muted text-muted-foreground',
              )}>
                {r.status === 'checking' && <Loader2 className="w-4 h-4 animate-spin" />}
                {r.status === 'ok' && <CheckCircle2 className="w-4 h-4" />}
                {r.status === 'error' && <XCircle className="w-4 h-4" />}
                {r.status === 'idle' && <Activity className="w-4 h-4" />}
                {r.status === 'skipped' && <Clock className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-sm font-medium truncate">{c.name}</code>
                  {c.requiresAuth && (
                    <Badge variant="outline" className="text-[10px] gap-1"><ShieldCheck className="w-3 h-3" />auth</Badge>
                  )}
                  {c.probe === null && <Badge variant="secondary" className="text-[10px]">scheduled</Badge>}
                  {r.latency != null && r.status !== 'idle' && (
                    <Badge variant="secondary" className="text-[10px]">{r.latency}ms</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {r.status === 'error'
                    ? <span className="text-destructive">{r.error}</span>
                    : (r.note ?? c.description)}
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
