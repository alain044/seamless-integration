import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Users, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';

interface LogEntry {
  id: string;
  action: string;
  success: boolean;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  user_id: string;
}

const AdminDashboardPage = () => {
  const { organization } = useOrganization();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    if (!organization) return;
    (async () => {
      const [{ data: logsData }, { count }] = await Promise.all([
        supabase
          .from('admin_access_log')
          .select('*')
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organization.id),
      ]);
      setLogs((logsData || []) as LogEntry[]);
      setMemberCount(count ?? 0);
    })();
  }, [organization]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-primary" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Owner controls for <span className="font-medium text-foreground">{organization?.name}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-base">Members</CardTitle>
              <CardDescription>Total people in this organization</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{memberCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Activity className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-base">Admin access events</CardTitle>
              <CardDescription>Recent step-up attempts</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>Last 50 admin access attempts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 && <p className="text-sm text-muted-foreground">No events yet.</p>}
          {logs.map((l) => (
            <div key={l.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant={l.success ? 'default' : 'destructive'}>{l.success ? 'OK' : 'FAIL'}</Badge>
                <div className="min-w-0">
                  <p className="font-medium truncate">{l.action}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(l.created_at).toLocaleString()} · {l.ip || 'unknown ip'}
                  </p>
                </div>
              </div>
              <code className="text-xs text-muted-foreground truncate max-w-[40%]">{l.user_id.slice(0, 8)}…</code>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboardPage;
