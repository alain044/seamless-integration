// Throwaway: is the configured Supabase project actually reachable?
// Reads .env in-process so the key is never echoed.
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
  if (m) env[m[1]] = m[2];
}

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
console.log("project url host:", url ? new URL(url).host : "(missing)");
console.log("anon key present:", Boolean(key), "length:", key?.length ?? 0);

const probe = async (label, path, opts = {}) => {
  try {
    const res = await fetch(`${url}${path}`, { ...opts, signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    console.log(`\n[${label}] ${path}`);
    console.log(`  status: ${res.status} ${res.statusText}`);
    console.log(`  body:   ${body.slice(0, 300) || "(empty)"}`);
    return res.status;
  } catch (e) {
    console.log(`\n[${label}] ${path}`);
    console.log(`  FAILED: ${e.name}: ${e.message}`);
    return null;
  }
};

const headers = { apikey: key, Authorization: `Bearer ${key}` };

// 1. DNS / TLS / gateway alive at all
await probe("root", "/rest/v1/", { headers: headers, method: "HEAD" });

// 2. Does a real table exist and answer?
await probe("budgets", "/rest/v1/budgets?select=id&limit=1", { headers });

// 3. Auth service health (is the project paused?)
await probe("auth", "/auth/v1/health", { headers });
