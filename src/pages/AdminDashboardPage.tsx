import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShieldCheck, Users, Activity, Inbox, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { BriefingComposer } from '@/components/admin/BriefingComposer';
import { toast } from 'sonner';

const IntegrityPanel = ({ orgId }: { orgId?: string }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const load = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from('integrity_reports').select('*')
      .eq('organization_id', orgId).order('created_at', { ascending: false }).limit(10);
    setReports(data || []);
  }, [orgId]);
  useEffect(() => { load(); }, [load]);
  const run = async () => {
    if (!orgId) return;
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integrity-check?organization_id=${orgId}`, {
        method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Check failed');
      toast.success(json.passed ? 'All checks passed' : `${json.issues_count} issue(s) found`);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setRunning(false); }
  };
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Persistence & sync integrity</CardTitle>
          <CardDescription>Validates budget rollups, briefing playback, stale support, etc.</CardDescription>
        </div>
        <Button onClick={run} disabled={running}><RefreshCw className={`w-4 h-4 mr-2 ${running ? 'animate-spin' : ''}`} /> Run check</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {reports.length === 0 && <p className="text-sm text-muted-foreground">No reports yet.</p>}
        {reports.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                {r.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-destructive" />}
                {r.passed ? 'Passed' : `${r.issues_count} issue(s)`}
              </span>
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            </div>
            <div className="text-xs space-y-1">
              {(r.checks || []).map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between">
                  <span>{c.name}</span>
                  <Badge variant={c.passed ? 'default' : 'destructive'} className="text-[10px]">{c.passed ? 'ok' : 'fail'}</Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};



interface LogEntry { id: string; action: string; success: boolean; ip: string | null; user_agent: string | null; created_at: string; user_id: string; }
interface SupportMsg { id: string; name: string; email: string; phone: string | null; message: string; status: string; error: string | null; created_at: string; }

const AdminDashboardPage = () => {
  const { organization } = useOrganization();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [supportMsgs, setSupportMsgs] = useState<SupportMsg[]>([]);

  useEffect(() => {
    if (!organization) return;
    (async () => {
      const [{ data: logsData }, { count }, { data: msgs }] = await Promise.all([
        supabase.from('admin_access_log').select('*').eq('organization_id', organization.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organization.id),
        supabase.from('support_messages').select('*').order('created_at', { ascending: false }).limit(100),
      ]);
      setLogs((logsData || []) as LogEntry[]);
      setMemberCount(count ?? 0);
      setSupportMsgs((msgs || []) as SupportMsg[]);
    })();
  }, [organization]);

  const statusVariant = (s: string) =>
    s === 'sent' ? 'default' : s === 'failed' ? 'destructive' : 'secondary';

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-primary" /> Admin Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Owner controls for <span className="font-medium text-foreground">{organization?.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Users className="w-5 h-5 text-primary" />
            <div><CardTitle className="text-base">Members</CardTitle><CardDescription>Total in this org</CardDescription></div>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{memberCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Activity className="w-5 h-5 text-primary" />
            <div><CardTitle className="text-base">Admin events</CardTitle><CardDescription>Recent step-up</CardDescription></div>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{logs.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Inbox className="w-5 h-5 text-primary" />
            <div><CardTitle className="text-base">Support messages</CardTitle><CardDescription>From contact form</CardDescription></div>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{supportMsgs.length}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="briefings">
        <TabsList>
          <TabsTrigger value="briefings">Briefings</TabsTrigger>
          <TabsTrigger value="support">Support Inbox</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
          <TabsTrigger value="integrity">Integrity</TabsTrigger>
        </TabsList>

        <TabsContent value="briefings" className="mt-4">
          <BriefingComposer />
        </TabsContent>

        <TabsContent value="support" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Contact form submissions</CardTitle>
              <CardDescription>All messages — including those that failed to deliver via email — are stored here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {supportMsgs.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
              {supportMsgs.map((m) => (
                <div key={m.id} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{m.name} <span className="text-muted-foreground font-normal text-sm">&lt;{m.email}&gt;</span></p>
                      {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                    </div>
                    <Badge variant={statusVariant(m.status) as any}>{m.status}</Badge>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                  {m.error && <p className="text-xs text-destructive">Email error: {m.error}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Audit log</CardTitle><CardDescription>Last 50 admin access attempts</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {logs.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
              {logs.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant={l.success ? 'default' : 'destructive'}>{l.success ? 'OK' : 'FAIL'}</Badge>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{l.action}</p>
                      <p className="text-xs text-muted-foreground truncate">{new Date(l.created_at).toLocaleString()} · {l.ip || 'unknown ip'}</p>
                    </div>
                  </div>
                  <code className="text-xs text-muted-foreground truncate max-w-[40%]">{l.user_id.slice(0, 8)}…</code>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="integrity" className="mt-4">
          <IntegrityPanel orgId={organization?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboardPage;
