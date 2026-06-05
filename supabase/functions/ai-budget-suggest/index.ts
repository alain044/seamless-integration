// AI Budget Recommendations: suggests per-category monthly budgets based on history.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Auth required" }, 401);
    const client = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "Auth required" }, 401);

    const since = new Date(); since.setMonth(since.getMonth() - 3);
    const { data: rows } = await client.from("expenses").select("category, amount, type, date")
      .eq("user_id", user.id).gte("date", since.toISOString().slice(0, 10));

    const byCat: Record<string, number> = {};
    (rows || []).forEach((r: any) => {
      if (r.type !== "expense") return;
      byCat[r.category] = (byCat[r.category] || 0) + Number(r.amount);
    });

    const summary = Object.entries(byCat)
      .map(([c, t]) => ({ category: c, monthly_avg: +(t / 3).toFixed(2), total_3mo: +t.toFixed(2) }))
      .sort((a, b) => b.monthly_avg - a.monthly_avg);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a financial planner. Suggest reasonable monthly budgets per category based on 3-month spending. Return JSON: { suggestions: [{category, monthly_budget, rationale}] }. Round to nearest 10." },
          { role: "user", content: `3-month spending:\n${JSON.stringify(summary)}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) return json({ error: "AI failed", status: aiRes.status }, aiRes.status);
    const data = await aiRes.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch {}
    return json({ suggestions: parsed.suggestions || [], summary });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

function json(o: unknown, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
