
-- AI Insights chat history (persists across devices)
CREATE TABLE public.ai_insights_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  attachments jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights_history TO authenticated;
GRANT ALL ON public.ai_insights_history TO service_role;
ALTER TABLE public.ai_insights_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own insight history"
  ON public.ai_insights_history FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_ai_insights_user_created ON public.ai_insights_history(user_id, created_at DESC);

-- AI Goal Coach persistent recommendations
CREATE TABLE public.ai_goal_recommendations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  goal_id uuid REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  strategy text NOT NULL,
  weekly_savings numeric,
  milestones jsonb,
  tips jsonb,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_goal_recommendations TO authenticated;
GRANT ALL ON public.ai_goal_recommendations TO service_role;
ALTER TABLE public.ai_goal_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own goal recommendations"
  ON public.ai_goal_recommendations FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_ai_goal_recs_user_goal ON public.ai_goal_recommendations(user_id, goal_id, created_at DESC);

-- Cron + HTTP for scheduled integrity checks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule hourly integrity check (calls dedicated cron edge function that loops orgs)
SELECT cron.schedule(
  'integrity-check-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://svixhxkbroelwmpxynjy.supabase.co/functions/v1/integrity-check-cron',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aXhoeGticm9lbHdtcHh5bmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTUwODgsImV4cCI6MjA5MzQ5MTA4OH0.yVmCWTcBpIZlgmxJMr5RJtO-TNp_uc9Bpu68_tNpYZc"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
