
-- ============ Expenses <-> Budgets sync trigger ============
CREATE OR REPLACE FUNCTION public.sync_budget_spent(_user_id uuid, _category text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.budgets
  SET spent = COALESCE((
    SELECT SUM(amount) FROM public.expenses
    WHERE user_id = _user_id AND category = _category AND type = 'expense'
  ), 0),
  updated_at = now()
  WHERE user_id = _user_id AND category = _category;
END;
$$;

CREATE OR REPLACE FUNCTION public.expenses_sync_budget()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.sync_budget_spent(OLD.user_id, OLD.category);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM public.sync_budget_spent(NEW.user_id, NEW.category);
    IF (OLD.category IS DISTINCT FROM NEW.category OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
      PERFORM public.sync_budget_spent(OLD.user_id, OLD.category);
    END IF;
    RETURN NEW;
  ELSE
    PERFORM public.sync_budget_spent(NEW.user_id, NEW.category);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS expenses_sync_budget_trg ON public.expenses;
CREATE TRIGGER expenses_sync_budget_trg
AFTER INSERT OR UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.expenses_sync_budget();

-- Backfill
UPDATE public.budgets b
SET spent = COALESCE((
  SELECT SUM(e.amount) FROM public.expenses e
  WHERE e.user_id = b.user_id AND e.category = b.category AND e.type = 'expense'
), 0);

-- ============ Admin step-up sessions ============
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own admin sessions" ON public.admin_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users delete own admin sessions" ON public.admin_sessions FOR DELETE USING (auth.uid() = user_id);
-- Inserts only via service role from edge function (no insert policy for users)

-- ============ Admin access log ============
CREATE TABLE IF NOT EXISTS public.admin_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  action text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  ip text,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners view org admin log" ON public.admin_access_log
FOR SELECT USING (organization_id IS NOT NULL AND has_role(auth.uid(), organization_id, 'owner'::app_role));
CREATE POLICY "users view own admin log" ON public.admin_access_log
FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS admin_sessions_user_exp_idx ON public.admin_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS admin_access_log_org_created_idx ON public.admin_access_log(organization_id, created_at DESC);
