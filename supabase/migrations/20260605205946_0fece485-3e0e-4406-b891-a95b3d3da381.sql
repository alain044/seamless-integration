
-- 1. Recurring expenses (detected subscriptions)
CREATE TABLE public.recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'monthly',
  last_seen DATE NOT NULL DEFAULT CURRENT_DATE,
  occurrences INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recurring" ON public.recurring_expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER set_recurring_updated BEFORE UPDATE ON public.recurring_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Goal progress history
CREATE TABLE public.goal_progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  saved NUMERIC NOT NULL,
  target NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.goal_progress_history TO authenticated;
GRANT ALL ON public.goal_progress_history TO service_role;
ALTER TABLE public.goal_progress_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goal history" ON public.goal_progress_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.snapshot_goal_progress() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.saved IS DISTINCT FROM NEW.saved) OR TG_OP = 'INSERT' THEN
    INSERT INTO public.goal_progress_history (goal_id, user_id, saved, target)
    VALUES (NEW.id, NEW.user_id, NEW.saved, NEW.target);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER goals_snapshot AFTER INSERT OR UPDATE ON public.savings_goals
FOR EACH ROW EXECUTE FUNCTION public.snapshot_goal_progress();

-- 3. Collaboration cases
CREATE TABLE public.collab_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  created_by UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collab_cases TO authenticated;
GRANT ALL ON public.collab_cases TO service_role;
ALTER TABLE public.collab_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members view cases" ON public.collab_cases FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "org members create cases" ON public.collab_cases FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND auth.uid() = created_by);
CREATE POLICY "case author or owner edits" ON public.collab_cases FOR UPDATE USING (auth.uid() = created_by OR public.has_role(auth.uid(), organization_id, 'owner'::app_role));
CREATE POLICY "case author or owner deletes" ON public.collab_cases FOR DELETE USING (auth.uid() = created_by OR public.has_role(auth.uid(), organization_id, 'owner'::app_role));
CREATE TRIGGER set_case_updated BEFORE UPDATE ON public.collab_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.collab_case_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.collab_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  body TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}'::uuid[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collab_case_messages TO authenticated;
GRANT ALL ON public.collab_case_messages TO service_role;
ALTER TABLE public.collab_case_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view case msgs if org member" ON public.collab_case_messages FOR SELECT
USING (EXISTS (SELECT 1 FROM public.collab_cases c WHERE c.id = case_id AND public.is_org_member(auth.uid(), c.organization_id)));
CREATE POLICY "post msgs if org member" ON public.collab_case_messages FOR INSERT
WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.collab_cases c WHERE c.id = case_id AND public.is_org_member(auth.uid(), c.organization_id)));
CREATE POLICY "delete own msgs" ON public.collab_case_messages FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.collab_case_assignees (
  case_id UUID NOT NULL REFERENCES public.collab_cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.collab_case_assignees TO authenticated;
GRANT ALL ON public.collab_case_assignees TO service_role;
ALTER TABLE public.collab_case_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view case assignees" ON public.collab_case_assignees FOR SELECT
USING (EXISTS (SELECT 1 FROM public.collab_cases c WHERE c.id = case_id AND public.is_org_member(auth.uid(), c.organization_id)));
CREATE POLICY "modify case assignees" ON public.collab_case_assignees FOR ALL
USING (EXISTS (SELECT 1 FROM public.collab_cases c WHERE c.id = case_id AND (c.created_by = auth.uid() OR public.has_role(auth.uid(), c.organization_id, 'owner'::app_role))))
WITH CHECK (EXISTS (SELECT 1 FROM public.collab_cases c WHERE c.id = case_id AND (c.created_by = auth.uid() OR public.has_role(auth.uid(), c.organization_id, 'owner'::app_role))));

-- 4. Briefing playback events + recipient fields
ALTER TABLE public.audio_briefing_recipients
  ADD COLUMN IF NOT EXISTS first_played_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_played_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS progress_seconds NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE public.briefing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id UUID NOT NULL REFERENCES public.audio_briefings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  position_seconds NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.briefing_events TO authenticated;
GRANT ALL ON public.briefing_events TO service_role;
ALTER TABLE public.briefing_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self insert briefing events" ON public.briefing_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "self or owner view events" ON public.briefing_events FOR SELECT
USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM public.audio_briefings b WHERE b.id = briefing_id AND public.has_role(auth.uid(), b.organization_id, 'owner'::app_role)
));

-- 5. Integrity reports
CREATE TABLE public.integrity_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  run_by UUID,
  checks JSONB NOT NULL,
  passed BOOLEAN NOT NULL,
  issues_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.integrity_reports TO authenticated;
GRANT ALL ON public.integrity_reports TO service_role;
ALTER TABLE public.integrity_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads reports" ON public.integrity_reports FOR SELECT
USING (public.has_role(auth.uid(), organization_id, 'owner'::app_role));
CREATE POLICY "owner inserts reports" ON public.integrity_reports FOR INSERT
WITH CHECK (public.has_role(auth.uid(), organization_id, 'owner'::app_role));
