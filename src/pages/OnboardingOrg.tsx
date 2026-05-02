import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Loader2, Building2, Users, Clock, CheckCircle2, XCircle, LogOut, Circle, MailCheck } from 'lucide-react';

interface PendingRequest {
  id: string;
  status: string;
  created_at: string;
  organization_id: string;
  message: string;
  organizations?: { name: string; type: string } | null;
}

const ORG_TYPES = ['company', 'bank', 'microfinance', 'cooperative', 'advisory', 'other'];

const OnboardingOrg = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { refresh } = useOrganization();

  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // create-org form
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('company');
  const [orgDesc, setOrgDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const emailVerified = !!user?.email_confirmed_at;

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('membership_requests')
      .select('id, status, created_at, organization_id, message, organizations(name, type)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setPending((data ?? []) as PendingRequest[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('membership-requests-self')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'membership_requests', filter: `user_id=eq.${user.id}` },
        async (payload: any) => {
          if (payload.new?.status === 'approved') {
            toast.success('Your membership was approved!');
            await refresh();
            navigate('/dashboard');
          } else {
            fetchRequests();
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refresh, navigate, fetchRequests]);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { toast.error('Enter a valid join code'); return; }
    setSubmitting(true);
    try {
      const { data: orgs, error: lookupErr } = await supabase.rpc('find_org_by_code', { _code: trimmed });
      if (lookupErr) throw lookupErr;
      if (!orgs || orgs.length === 0) {
        toast.error('No organization found with that code');
        setSubmitting(false);
        return;
      }
      const org = orgs[0];
      const { error } = await supabase.from('membership_requests').insert({
        user_id: user.id,
        organization_id: org.id,
        message: message.trim(),
        status: 'pending',
      });
      if (error) {
        if (error.code === '23505') toast.error('You already have a request for this organization');
        else throw error;
      } else {
        toast.success(`Request sent to ${org.name}`);
        setCode(''); setMessage('');
        fetchRequests();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const name = orgName.trim();
    if (name.length < 2) { toast.error('Enter an organization name (min 2 chars)'); return; }
    if (!orgType) { toast.error('Select an organization type'); return; }
    setCreating(true);
    try {
      const { data: org, error } = await supabase
        .from('organizations')
        .insert({ name, type: orgType, description: orgDesc.trim(), created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      // Owner membership; relies on trigger or insert here
      await supabase.from('organization_members').upsert({
        user_id: user.id,
        organization_id: org.id,
        role: 'owner',
      } as any, { onConflict: 'user_id,organization_id' });
      toast.success('Organization created!');
      await refresh();
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message ?? 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase.from('membership_requests').update({ status: 'cancelled' }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Request cancelled');
    fetchRequests();
  };

  const resendVerification = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
    if (error) toast.error(error.message);
    else toast.success('Verification email sent. Check your inbox.');
  };

  const statusBadge = (status: string) => {
    if (status === 'pending') return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
    if (status === 'approved') return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1"><CheckCircle2 className="w-3 h-3" />Approved</Badge>;
    if (status === 'rejected') return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const hasActivePending = pending.some((p) => p.status === 'pending');
  const hasApproved = pending.some((p) => p.status === 'approved');

  // Checklist progress
  const steps = [
    { label: 'Account created', done: !!user },
    { label: 'Email verified', done: emailVerified },
    { label: 'Join or create your organization', done: hasApproved },
    { label: 'Dashboard unlocked', done: hasApproved && emailVerified },
  ];
  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-4">
        {/* Progress checklist */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Setup progress</CardTitle>
              <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {steps.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-sm">
                {s.done
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className={s.done ? 'text-foreground' : 'text-muted-foreground'}>{s.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {!emailVerified && (
          <Alert>
            <MailCheck className="w-4 h-4" />
            <AlertTitle>Verify your email</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-2">
              <span className="text-xs">We sent a confirmation link to {user?.email}.</span>
              <Button size="sm" variant="outline" onClick={resendVerification}>Resend</Button>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Set up your organization</CardTitle>
            <CardDescription>Create a new one, or join an existing organization with a code.</CardDescription>
          </CardHeader>
          <CardContent>
            {hasActivePending && (
              <Alert className="mb-4">
                <Clock className="w-4 h-4" />
                <AlertTitle>Awaiting approval</AlertTitle>
                <AlertDescription>Your membership request is pending. You'll get full access as soon as an admin approves it.</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="join">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="join">Join</TabsTrigger>
                <TabsTrigger value="create">Create</TabsTrigger>
              </TabsList>

              <TabsContent value="join" className="pt-4">
                <form onSubmit={handleSubmitRequest} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Organization join code</Label>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                      placeholder="e.g. A4K9PXR2"
                      maxLength={12}
                      className="font-mono tracking-widest text-center"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message (optional)</Label>
                    <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={300} />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting || !code.trim()}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Users className="mr-2 h-4 w-4" /> Request access
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="create" className="pt-4">
                <form onSubmit={handleCreateOrg} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Organization name *</Label>
                    <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Microfinance" required minLength={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orgType">Type *</Label>
                    <Select value={orgType} onValueChange={setOrgType}>
                      <SelectTrigger id="orgType"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORG_TYPES.map((tp) => (
                          <SelectItem key={tp} value={tp}>{t(`org.types.${tp}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orgDesc">Description</Label>
                    <Textarea id="orgDesc" value={orgDesc} onChange={(e) => setOrgDesc(e.target.value)} rows={2} maxLength={300} />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={creating || orgName.trim().length < 2 || !orgType}
                  >
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Building2 className="mr-2 h-4 w-4" /> Create organization
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {loading ? null : pending.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Your requests</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {pending.map((req) => (
                <div key={req.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{req.organizations?.name ?? 'Organization'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {statusBadge(req.status)}
                    {req.status === 'pending' && (
                      <Button size="sm" variant="ghost" onClick={() => handleCancel(req.id)}>Cancel</Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Button type="button" variant="ghost" className="w-full" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> {t('nav.signOut')}
        </Button>
      </div>
    </div>
  );
};

export default OnboardingOrg;
