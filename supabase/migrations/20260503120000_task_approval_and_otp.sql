-- Task approval workflow
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Per-login email OTP table (used by login-otp edge function)
CREATE TABLE IF NOT EXISTS public.login_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_otps_user_idx ON public.login_otps(user_id, created_at DESC);
ALTER TABLE public.login_otps ENABLE ROW LEVEL SECURITY;
-- No client policies; only edge functions (service role) read/write.
