// Integrity check: validates persistence + sync across modules for an organization.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Auth required" }, 401);
    const client = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "Auth required" }, 401);

    const url = new URL(req.url);
    const orgId = url.searchParams.get("organization_id");
    if (!orgId) return json({ error: "organization_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isOwner } = await admin.rpc("has_role", { _user_id: user.id, _org_id: orgId, _role: "owner" });
    if (!isOwner) return json({ error: "Unauthorized Access: You do not have permission to access administrative resources." }, 403);

    const checks: any[] = [];

    // Budgets ↔ expenses
    const { data: budgets } = await admin.from("budgets").select("user_id, category, spent");
    const budgetIssues: any[] = [];
    for (const b of budgets || []) {
      const { data: exps } = await admin.from("expenses").select("amount")
        .eq("user_id", b.user_id).eq("category", b.category).eq("type", "expense");
      const actual = (exps || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
      if (Math.abs(actual - Number(b.spent)) > 0.01) {
        budgetIssues.push({ category: b.category, recorded: b.spent, actual });
      }
    }
    checks.push({ name: "budget_rollup", passed: budgetIssues.length === 0, issues: budgetIssues });

    // Stale support messages
    const oneHour = new Date(Date.now() - 3600_000).toISOString();
    const { data: stale } = await admin.from("support_messages").select("id, created_at, status")
      .eq("status", "pending").lt("created_at", oneHour);
    checks.push({ name: "support_messages_pending", passed: (stale?.length ?? 0) === 0, issues: stale ?? [] });

    // Briefing recipient consistency
    const { data: briefRecs } = await admin.from("audio_briefing_recipients")
      .select("id, listened_at, first_played_at, completed_at, briefing:audio_briefings!inner(organization_id)");
    const briefIssues = (briefRecs || []).filter((r: any) =>
      r.briefing?.organization_id === orgId &&
      ((r.completed_at && !r.first_played_at) || (r.listened_at && !r.first_played_at))
    );
    checks.push({ name: "briefing_playback_consistency", passed: briefIssues.length === 0, issues: briefIssues.length });

    const issuesCount = checks.reduce((s, c) => s + (c.passed ? 0 : (Array.isArray(c.issues) ? c.issues.length : 1)), 0);
    const passed = issuesCount === 0;

    await admin.from("integrity_reports").insert({
      organization_id: orgId, run_by: user.id, checks, passed, issues_count: issuesCount,
    });

    return json({ passed, issues_count: issuesCount, checks });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

function json(o: unknown, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
