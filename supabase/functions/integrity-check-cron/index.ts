// Cron entrypoint: runs integrity checks for every organization, notifies owners on failures.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: orgs } = await admin.from("organizations").select("id, name");
  const results: any[] = [];

  for (const org of orgs || []) {
    try {
      // Budget rollups
      const { data: budgets } = await admin.from("budgets").select("user_id, category, spent");
      const budgetIssues: any[] = [];
      for (const b of budgets || []) {
        const { data: exps } = await admin.from("expenses").select("amount")
          .eq("user_id", b.user_id).eq("category", b.category).eq("type", "expense");
        const actual = (exps || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
        if (Math.abs(actual - Number(b.spent)) > 0.01) {
          budgetIssues.push({ category: b.category, recorded: Number(b.spent), actual });
        }
      }

      // Stale support messages
      const oneHour = new Date(Date.now() - 3600_000).toISOString();
      const { data: stale } = await admin.from("support_messages").select("id")
        .eq("status", "pending").lt("created_at", oneHour);

      const checks = [
        { name: "budget_rollup", passed: budgetIssues.length === 0, issues: budgetIssues },
        { name: "support_messages_pending", passed: (stale?.length ?? 0) === 0, issues: stale?.length ?? 0 },
      ];
      const issues_count = checks.reduce((s, c) => s + (c.passed ? 0 : (Array.isArray(c.issues) ? c.issues.length : 1)), 0);
      const passed = issues_count === 0;

      await admin.from("integrity_reports").insert({
        organization_id: org.id, run_by: null, checks, passed, issues_count,
      });

      // Notify owners on failure
      if (!passed) {
        const { data: owners } = await admin.from("organization_members")
          .select("user_id").eq("organization_id", org.id).eq("role", "owner");
        const notifs = (owners || []).map((o: any) => ({
          user_id: o.user_id,
          title: "Integrity check found issues",
          message: `${issues_count} issue(s) detected in ${org.name}. Review the Admin Integrity tab.`,
          type: "warning",
          link: "/dashboard/admin",
        }));
        if (notifs.length) await admin.from("notifications").insert(notifs);
      }

      results.push({ org: org.id, passed, issues_count });
    } catch (e: any) {
      results.push({ org: org.id, error: e.message });
    }
  }

  return new Response(JSON.stringify({ ran: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
