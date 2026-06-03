import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const FREE_LIMIT = 20;
const WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'unauthenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? 'check'; // 'check' or 'consume'

    // Fetch or create row
    const { data: existing } = await admin
      .from('ai_message_usage').select('*').eq('user_id', user.id).maybeSingle();

    let row = existing;
    if (!row) {
      const { data: created, error } = await admin
        .from('ai_message_usage')
        .insert({ user_id: user.id, count: 0, window_start: new Date().toISOString() })
        .select().single();
      if (error) throw error;
      row = created;
    }

    const windowAgeMs = Date.now() - new Date(row.window_start).getTime();
    if (windowAgeMs >= WINDOW_MS) {
      const { data: reset } = await admin
        .from('ai_message_usage')
        .update({ count: 0, window_start: new Date().toISOString() })
        .eq('user_id', user.id).select().single();
      row = reset!;
    }

    const remaining = Math.max(0, FREE_LIMIT - row.count);
    const msToReset = Math.max(0, WINDOW_MS - (Date.now() - new Date(row.window_start).getTime()));

    if (action === 'consume') {
      if (remaining <= 0) {
        return new Response(JSON.stringify({
          allowed: false, remaining: 0, limit: FREE_LIMIT, reset_in_ms: msToReset,
        }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: bumped } = await admin
        .from('ai_message_usage')
        .update({ count: row.count + 1 })
        .eq('user_id', user.id).select().single();
      return new Response(JSON.stringify({
        allowed: true, remaining: FREE_LIMIT - (bumped?.count ?? row.count + 1),
        limit: FREE_LIMIT, reset_in_ms: msToReset,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      allowed: remaining > 0, remaining, limit: FREE_LIMIT, reset_in_ms: msToReset,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
