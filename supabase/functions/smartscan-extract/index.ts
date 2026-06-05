// SmartScan AI: extract structured transactions from receipts/invoices/bills/PDFs/images.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const STANDARD_CATEGORIES = [
  "Food & Dining","Groceries","Transport","Fuel","Utilities","Rent","Mortgage",
  "Internet","Phone","Insurance","Healthcare","Education","Childcare",
  "Entertainment","Subscriptions","Shopping","Clothing","Personal Care","Gifts",
  "Donations","Travel","Hotels","Taxes","Fees & Charges","Savings","Investments",
  "Business","Office","Software","Income","Other",
];

const SYSTEM = `You are SmartScan AI. From a receipt, invoice, bill, bank statement, or financial document image/PDF, extract structured transactions. Output JSON only.

For each transaction return:
- date (YYYY-MM-DD; today if absent)
- merchant (string)
- amount (positive number)
- currency (3-letter, default USD)
- category (one of: ${STANDARD_CATEGORIES.join(", ")})
- type ("expense" or "income")
- description (short)
- is_recurring (boolean — true if obviously a subscription / recurring bill)

If the document contains multiple line-item transactions (e.g. a bank statement), return them all. If a single receipt, return one transaction.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Auth required" }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Auth required" }, 401);

    const { imageBase64, pdfText, fileName } = await req.json();
    if (!imageBase64 && !pdfText) return json({ error: "imageBase64 or pdfText required" }, 400);

    const userContent: any[] = [
      { type: "text", text: `Extract transactions from this document${fileName ? ` (${fileName})` : ""}. Respond as JSON: { "transactions": [...] }.` },
    ];
    if (imageBase64) {
      userContent.push({ type: "image_url", image_url: { url: imageBase64 } });
    }
    if (pdfText) {
      userContent.push({ type: "text", text: `\nDocument text:\n${pdfText.slice(0, 30000)}` });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI error:", aiRes.status, t);
      if (aiRes.status === 429) return json({ error: "Rate limit, please retry shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted." }, 402);
      return json({ error: "Extraction failed" }, 502);
    }

    const result = await aiRes.json();
    const text = result.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = { transactions: [] }; }
    const txns: any[] = Array.isArray(parsed.transactions) ? parsed.transactions : [];

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const rows = txns.map((t) => ({
      user_id: user.id,
      name: t.merchant || t.description || "SmartScan",
      category: STANDARD_CATEGORIES.includes(t.category) ? t.category : "Other",
      amount: Math.abs(Number(t.amount) || 0),
      date: t.date || new Date().toISOString().slice(0, 10),
      type: t.type === "income" ? "income" : "expense",
    })).filter((r) => r.amount > 0);

    if (rows.length === 0) return json({ inserted: 0, transactions: [] });

    const { data: inserted, error } = await admin.from("expenses").insert(rows).select();
    if (error) return json({ error: error.message }, 500);

    // Recurring detection
    const recurring = txns.filter((t) => t.is_recurring);
    if (recurring.length) {
      const rrows = recurring.map((t) => ({
        user_id: user.id,
        merchant: t.merchant || "Unknown",
        category: STANDARD_CATEGORIES.includes(t.category) ? t.category : "Other",
        amount: Math.abs(Number(t.amount) || 0),
        cadence: "monthly",
      }));
      await admin.from("recurring_expenses").insert(rrows);
    }

    return json({ inserted: inserted?.length ?? 0, transactions: inserted });
  } catch (e: any) {
    console.error("smartscan error", e);
    return json({ error: e.message || "Unknown error" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
