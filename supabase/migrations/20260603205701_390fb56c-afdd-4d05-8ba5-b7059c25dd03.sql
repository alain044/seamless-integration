CREATE TABLE public.ai_message_usage (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ai_message_usage TO authenticated;
GRANT ALL ON public.ai_message_usage TO service_role;

ALTER TABLE public.ai_message_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own usage" ON public.ai_message_usage
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own usage" ON public.ai_message_usage
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own usage" ON public.ai_message_usage
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_ai_message_usage_updated_at
  BEFORE UPDATE ON public.ai_message_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();