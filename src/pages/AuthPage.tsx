import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/sonner';
import { Loader2, Eye, EyeOff, ShieldCheck, KeyRound, Home, Mail, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** Map raw OAuth errors to user-friendly copy. */
const friendlyGoogleError = (raw?: string): { title: string; message: string } => {
  const msg = (raw ?? '').toLowerCase();
  if (!raw) return { title: 'Google sign-in failed', message: 'Something went wrong. Please try again.' };
  if (msg.includes('popup') && msg.includes('closed')) return { title: 'Sign-in cancelled', message: 'The Google window was closed before finishing. Try again to continue.' };
  if (msg.includes('popup') && msg.includes('block')) return { title: 'Popup blocked', message: 'Your browser blocked the Google popup. Allow popups for this site and retry.' };
  if (msg.includes('cancel')) return { title: 'Sign-in cancelled', message: 'You cancelled the Google sign-in. Try again whenever you are ready.' };
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) return { title: 'Network problem', message: 'We could not reach Google. Check your internet connection and retry.' };
  if (msg.includes('timeout') || msg.includes('timed out')) return { title: 'Google took too long', message: 'The request timed out. Please try again.' };
  if (msg.includes('access_denied') || msg.includes('denied')) return { title: 'Access denied', message: 'Google did not grant access. Make sure to approve the permissions on the next attempt.' };
  if (msg.includes('invalid') && msg.includes('redirect')) return { title: 'Configuration issue', message: 'The redirect URL is not allowed. Please contact support.' };
  if (msg.includes('disabled') || msg.includes('not enabled')) return { title: 'Google sign-in unavailable', message: 'Google sign-in is currently disabled. Try email & password instead.' };
  if (msg.includes('rate') || msg.includes('too many')) return { title: 'Too many attempts', message: 'You have tried a few times. Please wait a moment and retry.' };
  return { title: 'Google sign-in failed', message: raw };
};

const hashCode = async (code: string): Promise<string> => {
  const data = new TextEncoder().encode(code);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

type Mode = 'login' | 'signup' | 'forgot' | 'mfa' | 'otp';

const AuthPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');

  // TOTP MFA state
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  // Email OTP per-login state
  const [otpCode, setOtpCode] = useState('');

  // Google sign-in error state
  const [googleError, setGoogleError] = useState<{ title: string; message: string } | null>(null);
  const [googleAttempts, setGoogleAttempts] = useState(0);

  const completeSignIn = () => {
    toast.success('Signed in');
    navigate('/dashboard');
  };

  /** After a successful password verification, send a one-time code to the
   *  user's email and require them to enter it before granting the dashboard. */
  const startEmailOtpStep = async (targetEmail: string) => {
    // Sign out the password session — we'll re-sign-in via OTP verification.
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: false },
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(`Verification code sent to ${targetEmail}`);
    setMode('otp');
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check TOTP first (stronger).
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.find((f) => f.status === 'verified');
        if (totp) {
          setMfaFactorId(totp.id);
          setMode('mfa');
          setLoading(false);
          return;
        }
      }
      // Otherwise enforce email OTP per-login.
      const sent = await startEmailOtpStep(email);
      setLoading(false);
      if (!sent) return;
    } catch (err: any) {
      setLoading(false);
      toast.error(err.message);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = otpCode.replace(/\D/g, '');
    if (token.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    completeSignIn();
  };

  const resendOtp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success('New code sent');
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      toast.success(t('auth.checkEmail'));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Enter your email'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Check your inbox for a password reset link.');
    setMode('login');
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId) return;
    setLoading(true);
    try {
      if (useRecovery) {
        const normalized = mfaCode.trim().toUpperCase().replace(/\s/g, '');
        if (!normalized) throw new Error('Enter a recovery code');
        const hash = await hashCode(normalized);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const { data: row } = await supabase
          .from('mfa_recovery_codes').select('id')
          .eq('user_id', user.id).eq('code_hash', hash).is('used_at', null).maybeSingle();
        if (!row) throw new Error('Invalid or already used recovery code');
        await supabase.from('mfa_recovery_codes').update({ used_at: new Date().toISOString() }).eq('id', row.id);
        await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
        toast.success('Recovery code accepted. Please re-enroll 2FA from Settings.');
        setLoading(false);
        completeSignIn();
        return;
      }
      const digits = mfaCode.replace(/\D/g, '');
      if (digits.length !== 6) throw new Error('Enter the 6-digit code');
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (cErr || !challenge) throw cErr || new Error('Challenge failed');
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: digits });
      if (vErr) throw vErr;
      setLoading(false);
      completeSignIn();
    } catch (err: any) {
      setLoading(false);
      toast.error(err.message);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setGoogleError(null);
    setGoogleAttempts((n) => n + 1);
    try {
      const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
      if (result.error) {
        setLoading(false);
        const friendly = friendlyGoogleError(result.error.message);
        setGoogleError(friendly);
        toast.error(friendly.title, { description: friendly.message });
        return;
      }
      if (result.redirected) return;
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.find((f) => f.status === 'verified');
        if (totp) { setMfaFactorId(totp.id); setMode('mfa'); setLoading(false); return; }
      }
      setLoading(false);
      completeSignIn();
    } catch (err: any) {
      setLoading(false);
      const friendly = friendlyGoogleError(err?.message);
      setGoogleError(friendly);
      toast.error(friendly.title, { description: friendly.message });
    }
  };

  const cancelMfa = async () => {
    await supabase.auth.signOut();
    setMfaFactorId(null); setMfaCode(''); setUseRecovery(false); setMode('login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center relative">
          <Button asChild variant="ghost" size="sm" className="absolute left-2 top-2 text-muted-foreground">
            <Link to="/"><Home className="w-4 h-4 mr-1" /> Home</Link>
          </Button>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
            {t('auth.title')}
          </CardTitle>
          <CardDescription>
            {mode === 'login' && t('auth.signInToAccount')}
            {mode === 'signup' && t('auth.createNewAccount')}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'mfa' && 'Two-factor verification'}
            {mode === 'otp' && 'Enter the code we just emailed you'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'otp' ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2">
                <Mail className="w-4 h-4 text-primary mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  We sent a 6-digit verification code to <span className="font-medium text-foreground">{email}</span>. It expires in a few minutes.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  className="text-center text-lg tracking-widest font-mono"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || otpCode.length !== 6}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & sign in
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button type="button" onClick={resendOtp} disabled={loading} className="text-primary hover:underline">Resend code</button>
                <button type="button" onClick={() => { setOtpCode(''); setMode('login'); }} className="text-muted-foreground hover:text-foreground">Use a different account</button>
              </div>
            </form>
          ) : mode === 'mfa' ? (
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2">
                {useRecovery ? <KeyRound className="w-4 h-4 text-primary mt-0.5" /> : <ShieldCheck className="w-4 h-4 text-primary mt-0.5" />}
                <p className="text-xs text-muted-foreground">
                  {useRecovery
                    ? 'Enter one of your saved recovery codes. It will be consumed and your authenticator will be reset — re-enroll 2FA after signing in.'
                    : 'Open your authenticator app and enter the 6-digit code to finish signing in.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfaCode">{useRecovery ? 'Recovery code' : 'Verification code'}</Label>
                <Input
                  id="mfaCode"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(useRecovery ? e.target.value.toUpperCase().slice(0, 16) : e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={useRecovery ? 'AB2CD-EFG3H' : '123456'}
                  inputMode={useRecovery ? 'text' : 'numeric'}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  className={useRecovery ? 'font-mono' : ''}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & sign in
              </Button>
              <button type="button" onClick={() => { setUseRecovery((v) => !v); setMfaCode(''); }} className="text-xs text-primary hover:underline w-full text-center">
                {useRecovery ? 'Use authenticator code instead' : 'Use a recovery code instead'}
              </button>
              <Button type="button" variant="ghost" className="w-full" onClick={cancelMfa}>Cancel</Button>
            </form>
          ) : mode === 'forgot' ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} required autoFocus />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send reset link
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode('login')}>Back to sign in</Button>
            </form>
          ) : (
            <>
              <Button type="button" variant="outline" className="w-full mb-4" onClick={handleGoogle} disabled={loading}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.13 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
                Continue with Google
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">or</span></div>
              </div>
              <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('auth.namePlaceholder')} required />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} required />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('auth.password')}</Label>
                    {mode === 'login' && (
                      <button type="button" onClick={() => setMode('forgot')} className="text-xs text-primary hover:underline">Forgot password?</button>
                    )}
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} className="pr-10" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'} tabIndex={-1}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === 'login' ? t('auth.signIn') : t('auth.signUp')}
                </Button>
              </form>
            </>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
              <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-primary underline hover:no-underline">
                {mode === 'login' ? t('auth.signUp') : t('auth.signIn')}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
