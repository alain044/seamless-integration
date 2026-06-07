
-- security_events
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip text,
  user_agent text,
  route text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.security_events TO authenticated;
GRANT INSERT ON public.security_events TO anon;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone insert security events" ON public.security_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "users view own security events" ON public.security_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user_created ON public.security_events(user_id, created_at DESC);

-- smartscan_imports
CREATE TABLE IF NOT EXISTS public.smartscan_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text,
  status text NOT NULL DEFAULT 'pending',
  extracted_count int NOT NULL DEFAULT 0,
  inserted_count int NOT NULL DEFAULT 0,
  duplicate_count int NOT NULL DEFAULT 0,
  raw jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.smartscan_imports TO authenticated;
GRANT ALL ON public.smartscan_imports TO service_role;
ALTER TABLE public.smartscan_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own smartscan imports" ON public.smartscan_imports
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Merge duplicate budgets
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT user_id, category, MIN(created_at) AS keep_at, SUM(limit_amount) AS total
    FROM public.budgets GROUP BY user_id, category HAVING COUNT(*) > 1
  LOOP
    UPDATE public.budgets SET limit_amount = r.total
      WHERE user_id = r.user_id AND category = r.category AND created_at = r.keep_at;
    DELETE FROM public.budgets
      WHERE user_id = r.user_id AND category = r.category AND created_at <> r.keep_at;
    PERFORM public.sync_budget_spent(r.user_id, r.category);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS budgets_user_category_uniq
  ON public.budgets(user_id, category);

-- can_manage_user_finance helper
CREATE OR REPLACE FUNCTION public.can_manage_user_finance(_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members am
    JOIN public.organization_members tm ON tm.organization_id = am.organization_id
    WHERE am.user_id = auth.uid()
      AND tm.user_id = _target
      AND am.role IN ('owner'::public.app_role, 'admin'::public.app_role)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_user_finance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_user_finance(uuid) TO authenticated;

-- Allow admins/owners cross-user manage
DROP POLICY IF EXISTS "admins manage org expenses" ON public.expenses;
CREATE POLICY "admins manage org expenses" ON public.expenses FOR ALL TO authenticated
  USING (public.can_manage_user_finance(user_id))
  WITH CHECK (public.can_manage_user_finance(user_id));

DROP POLICY IF EXISTS "admins manage org budgets" ON public.budgets;
CREATE POLICY "admins manage org budgets" ON public.budgets FOR ALL TO authenticated
  USING (public.can_manage_user_finance(user_id))
  WITH CHECK (public.can_manage_user_finance(user_id));

DROP POLICY IF EXISTS "admins manage org savings goals" ON public.savings_goals;
CREATE POLICY "admins manage org savings goals" ON public.savings_goals FOR ALL TO authenticated
  USING (public.can_manage_user_finance(user_id))
  WITH CHECK (public.can_manage_user_finance(user_id));

-- Storage avatar fixes
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);
