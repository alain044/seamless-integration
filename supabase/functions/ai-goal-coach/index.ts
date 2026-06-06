// AI Goal Coach: weekly savings plan, milestones, tips. Persists every recommendation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

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

    const { goal_id } = await req.json();
    if (!goal_id) return json({ error: "goal_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: goal } = await admin.from("savings_goals").select("*").eq("id", goal_id).eq("user_id", user.id).maybeSingle();
    if (!goal) return json({ error: "Goal not found" }, 404);

    // Pull 90-day spending context
    const since = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    const { data: exps } = await admin.from("expenses").select("amount, category, type, date")
      .eq("user_id", user.id).gte("date", since);

    const totalIncome = (exps || []).filter((e: any) => e.type === "income").reduce((s: number, e: any) => s + Number(e.amount), 0);
    const totalExpense = (exps || []).filter((e: any) => e.type === "expense").reduce((s: number, e: any) => s + Number(e.amount), 0);
    const byCat: Record<string, number> = {};
    for (const e of (exps || []).filter((e: any) => e.type === "expense")) {
      byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount);
    }

    const remaining = Number(goal.target) - Number(goal.saved);
    const prompt = `Savings goal: "${goal.name}" — target $${goal.target}, saved $${goal.saved}, remaining $${remaining}.
Last 90 days: income $${totalIncome.toFixed(2)}, spending $${totalExpense.toFixed(2)}, by category: ${JSON.stringify(byCat)}.

Return JSON: {
 "strategy": "1-paragraph plan",
 "weekly_savings": number,
 "milestones": [{"label": string, "amount": number}],
 "tips": [string, string, string]
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a friendly, practical AI savings coach. Respond JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) {
      if (aiRes.status === 429) return json({ error: "Rate limit, retry shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "AI request failed" }, 502);
    }
    const result = await aiRes.json();
    const text = result.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = {}; }

    const { data: saved, error } = await admin.from("ai_goal_recommendations").insert({
      user_id: user.id,
      goal_id,
      strategy: parsed.strategy || "",
      weekly_savings: Number(parsed.weekly_savings) || null,
      milestones: parsed.milestones || [],
      tips: parsed.tips || [],
      raw_response: parsed,
    }).select().single();
    if (error) return json({ error: error.message }, 500);

    return json({ recommendation: saved });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

function json(o: unknown, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
