import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ verified: false }, 200);

  const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ verified: false });

  const url = new URL(req.url);
  const orgId = url.searchParams.get('organization_id');
  if (!orgId) return json({ verified: false });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isOwner } = await admin.rpc('has_role', {
    _user_id: user.id, _org_id: orgId, _role: 'owner',
  });
  if (!isOwner) return json({ verified: false, reason: 'not_owner' });

  const { data } = await admin
    .from('admin_sessions')
    .select('expires_at')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return json({ verified: !!data, expires_at: data?.expires_at ?? null, is_owner: true });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
