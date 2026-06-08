
-- Threaded replies on collab messages
ALTER TABLE public.collab_case_messages
  ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES public.collab_case_messages(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_collab_msgs_parent ON public.collab_case_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_collab_msgs_case ON public.collab_case_messages(case_id, created_at);

-- Full-text search index on case title+description
CREATE INDEX IF NOT EXISTS idx_collab_cases_search
  ON public.collab_cases USING gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'')));

-- Mention -> notification trigger
CREATE OR REPLACE FUNCTION public.notify_collab_mentions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid;
  case_title text;
  author_name text;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN RETURN NEW; END IF;
  SELECT title INTO case_title FROM public.collab_cases WHERE id = NEW.case_id;
  SELECT COALESCE(full_name, email, 'A teammate') INTO author_name FROM public.profiles WHERE user_id = NEW.user_id;
  FOREACH uid IN ARRAY NEW.mentions LOOP
    IF uid <> NEW.user_id THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (uid, 'You were mentioned',
        author_name || ' mentioned you in "' || COALESCE(case_title, 'a case') || '"',
        'info', '/dashboard/collaborate');
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS collab_msgs_notify_mentions ON public.collab_case_messages;
CREATE TRIGGER collab_msgs_notify_mentions
AFTER INSERT ON public.collab_case_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_collab_mentions();

-- Helper to check if 2FA grace period has expired (7 days from signup)
CREATE OR REPLACE FUNCTION public.mfa_grace_remaining(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(0, 7 - EXTRACT(DAY FROM (now() - created_at))::int)
  FROM public.profiles WHERE user_id = _user_id;
$$;
