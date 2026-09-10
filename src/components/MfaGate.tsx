import { useCallback, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, Loader2, Copy, Check } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

/**
 * Mandatory 2FA gate with 7-day grace period from account creation.
 * - User has verified TOTP factor → render children.
 * - Within grace period & no factor → render children with a reminder banner above.
 * - Past grace period & no factor → force enrollment screen.
 */
export const MfaGate = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const [state, setState] = useState<'loading' | 'ok' | 'grace' | 'required'>('loading');
  const [graceDays, setGraceDays] = useState(0);
  const [enrollment, setEnrollment] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const evaluate = useCallback(async () => {
    if (!user) return;
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp.find((f) => f.status === 'verified');
    if (verified) { setState('ok'); return; }
    const { data: remaining } = await supabase.rpc('mfa_grace_remaining', { _user_id: user.id });
    const days = Number(remaining ?? 0);
    setGraceDays(days);
    setState(days > 0 ? 'grace' : 'required');
  }, [user]);

  useEffect(() => { evaluate(); }, [evaluate]);

  const startEnroll = async () => {
    setBusy(true);
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.totp ?? []) {
      if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const verifyEnroll = async () => {
    if (!enrollment || code.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setBusy(true);
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: enrollment.id });
    if (cErr || !challenge) { setBusy(false); toast.error(cErr?.message ?? 'Challenge failed'); return; }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: enrollment.id, challengeId: challenge.id, code,
    });
    setBusy(false);
    if (vErr) { toast.error(vErr.message); return; }
    toast.success('Two-factor authentication enabled');
    setEnrollment(null); setCode('');
    await evaluate();
  };

  const copySecret = async () => {
    if (!enrollment) return;
    await navigator.clipboard.writeText(enrollment.secret);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  if (state === 'loading') {
    return <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>;
  }

  if (state === 'required') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Two-Factor Authentication Required</CardTitle>
            <CardDescription>
              Your 7-day grace period has ended. Set up an authenticator app to continue using the platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!enrollment ? (
              <>
                <Alert>
                  <AlertTitle>Why 2FA?</AlertTitle>
                  <AlertDescription className="text-xs">
                    Protects your financial data even if your password is compromised. Use Google Authenticator, 1Password, or any TOTP app.
                  </AlertDescription>
                </Alert>
                <Button className="w-full" onClick={startEnroll} disabled={busy}>
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Set up authenticator
                </Button>
                <Button variant="ghost" className="w-full" onClick={signOut}>Sign out</Button>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-lg bg-white p-2 border border-border" dangerouslySetInnerHTML={{ __html: enrollment.qr }} />
                  <div className="w-full">
                    <Label className="text-xs text-muted-foreground">Or enter this key manually</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded break-all">{enrollment.secret}</code>
                      <Button size="icon" variant="outline" onClick={copySecret}>
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totp">6-digit code from your authenticator</Label>
                  <Input id="totp" value={code} maxLength={6} inputMode="numeric"
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456" className="text-center text-lg tracking-widest font-mono" />
                </div>
                <Button className="w-full" onClick={verifyEnroll} disabled={busy || code.length !== 6}>
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verify & enable
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {state === 'grace' && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs flex items-center justify-between gap-2">
          <span className="text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            Two-factor authentication required in <strong>{graceDays} day{graceDays === 1 ? '' : 's'}</strong>.
          </span>
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => window.location.href = '/dashboard/settings#security'}>
            Set up now
          </Button>
        </div>
      )}
      {children}
    </>
  );
};
