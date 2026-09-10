
-- 1. Profiles: add second phone
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone2 text DEFAULT '';

-- 2. Support messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can view support messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND role = 'owner'));

-- 3. Audio briefings
CREATE TABLE IF NOT EXISTS public.audio_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  audio_path text NOT NULL,
  duration_seconds int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.audio_briefing_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL REFERENCES public.audio_briefings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  listened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(briefing_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_briefings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_briefing_recipients TO authenticated;
GRANT ALL ON public.audio_briefings TO service_role;
GRANT ALL ON public.audio_briefing_recipients TO service_role;
ALTER TABLE public.audio_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_briefing_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage briefings" ON public.audio_briefings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), organization_id, 'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), organization_id, 'owner'::public.app_role));
CREATE POLICY "Recipients can view their briefings" ON public.audio_briefings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audio_briefing_recipients r WHERE r.briefing_id = id AND r.user_id = auth.uid()));

CREATE POLICY "Owners manage recipients" ON public.audio_briefing_recipients
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.audio_briefings b WHERE b.id = briefing_id AND public.has_role(auth.uid(), b.organization_id, 'owner'::public.app_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.audio_briefings b WHERE b.id = briefing_id AND public.has_role(auth.uid(), b.organization_id, 'owner'::public.app_role)));
CREATE POLICY "Recipients view own row" ON public.audio_briefing_recipients
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Recipients mark listened" ON public.audio_briefing_recipients
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 4. Org messages (realtime chat)
CREATE TABLE IF NOT EXISTS public.org_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.org_messages TO authenticated;
GRANT ALL ON public.org_messages TO service_role;
ALTER TABLE public.org_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read org messages" ON public.org_messages
  FOR SELECT TO authenticated
  USING (public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "Members post messages" ON public.org_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(auth.uid(), organization_id) AND user_id = auth.uid());
CREATE POLICY "Author or owner deletes" ON public.org_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), organization_id, 'owner'::public.app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.org_messages;
ALTER TABLE public.org_messages REPLICA IDENTITY FULL;

-- 5. Storage policies for briefings bucket (bucket created via tool separately)
CREATE POLICY "Owners upload briefings" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'briefings' AND EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
      AND organization_id::text = (storage.foldername(name))[1]
  ));
CREATE POLICY "Owners read briefings" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'briefings' AND EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
      AND organization_id::text = (storage.foldername(name))[1]
  ));
CREATE POLICY "Recipients read their briefings" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'briefings' AND EXISTS (
    SELECT 1 FROM public.audio_briefings b
    JOIN public.audio_briefing_recipients r ON r.briefing_id = b.id
    WHERE b.audio_path = name AND r.user_id = auth.uid()
  ));
CREATE POLICY "Owners delete briefings" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'briefings' AND EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND role = 'owner'
      AND organization_id::text = (storage.foldername(name))[1]
  ));
