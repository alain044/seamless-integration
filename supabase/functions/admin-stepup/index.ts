import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const ip = req.headers.get('x-forwarded-for') ?? '';
    const ua = req.headers.get('user-agent') ?? '';

    const body = await req.json().catch(() => ({}));
    const password: string | undefined = body.password;
    const organization_id: string | undefined = body.organization_id;

    if (!organization_id || typeof organization_id !== 'string') {
      return json({ error: 'organization_id required' }, 400);
    }
    if (!password || typeof password !== 'string' || password.length < 1) {
      return json({ error: 'password required' }, 400);
    }

    // Verify user is owner of the org
    const { data: isOwner } = await admin.rpc('has_role', {
      _user_id: user.id, _org_id: organization_id, _role: 'owner',
    });
    if (!isOwner) {
      await admin.from('admin_access_log').insert({
        user_id: user.id, organization_id, action: 'stepup_attempt',
        success: false, ip, user_agent: ua, details: { reason: 'not_owner' },
      });
      return json({ error: 'Not authorized' }, 403);
    }

    // Verify password by attempting sign in (does not affect current session)
    const verifyClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { error: pwErr } = await verifyClient.auth.signInWithPassword({
      email: user.email!, password,
    });
    if (pwErr) {
      await admin.from('admin_access_log').insert({
        user_id: user.id, organization_id, action: 'stepup_attempt',
        success: false, ip, user_agent: ua, details: { reason: 'bad_password' },
      });
      return json({ error: 'Invalid password' }, 401);
    }

    // Create admin session (15 min)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data: session, error: sErr } = await admin.from('admin_sessions').insert({
      user_id: user.id, organization_id, expires_at: expiresAt,
    }).select().single();
    if (sErr) return json({ error: sErr.message }, 500);

    await admin.from('admin_access_log').insert({
      user_id: user.id, organization_id, action: 'stepup_success',
      success: true, ip, user_agent: ua,
    });

    return json({ session_id: session.id, expires_at: expiresAt });
  } catch (e: any) {
    return json({ error: e.message ?? 'Internal error' }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
