/**
 * Single source of truth for the deployed edge functions.
 *
 * The System Status page used to hardcode a list of five functions, which had
 * already drifted from the fourteen actually in `supabase/functions/`. This
 * registry replaces that hardcoded array, and `src/test/edgeFunctions.test.ts`
 * fails if the two ever diverge again.
 *
 * Probe policy — a health check must not cost money, send email, or mutate data:
 *  - Every probe is sent with the anonymous key only. For auth-gated functions
 *    the expected response is therefore the rejection itself (401), which proves
 *    the function is deployed and enforcing auth without running its AI
 *    generation or touching the caller's data.
 *  - Cron entrypoints (`check-price-alerts`, `integrity-check-cron`) DO work
 *    when called over HTTP. Probing them would run a real background job and
 *    emit notifications, so they are listed but never invoked.
 *  - `send-contact-message` is probed with a deliberately invalid body: zod
 *    validation runs before the insert, so a 400 proves liveness without
 *    storing a support row or emailing anyone.
 *  - `finance-chat` and `ai-insights` are public and do call the AI gateway;
 *    that is intentional, since they are the only way to verify the gateway
 *    itself is reachable.
 */

export interface EdgeFunctionProbe {
  method: 'GET' | 'POST';
  /** Query string appended to the function URL, e.g. '?base=USD'. */
  query?: string;
  body?: unknown;
  /** Status codes proving the function is deployed and behaving, sent anonymously. */
  expect: number[];
}

export interface EdgeFunctionSpec {
  name: string;
  description: string;
  /** null for functions that must not be invoked over HTTP. */
  probe: EdgeFunctionProbe | null;
  /** Required when `probe` is null — why we refuse to call it. */
  scheduledReason?: string;
  /** True when the function rejects anonymous callers, so 401 is the healthy answer. */
  requiresAuth?: boolean;
}

export const EDGE_FUNCTIONS: EdgeFunctionSpec[] = [
  {
    name: 'finance-chat',
    description: 'Streaming public finance assistant',
    probe: { method: 'POST', body: { messages: [{ role: 'user', content: 'ping' }] }, expect: [200] },
  },
  {
    name: 'ai-insights',
    description: 'Portfolio & finance advisor',
    probe: { method: 'POST', body: { messages: [{ role: 'user', content: 'ping' }] }, expect: [200] },
  },
  {
    name: 'market-quotes',
    description: 'Live stock quotes',
    probe: { method: 'GET', query: '?action=quotes&symbols=AAPL', expect: [200] },
  },
  {
    name: 'exchange-rates',
    description: 'Currency conversion rates',
    probe: { method: 'GET', query: '?base=USD', expect: [200] },
  },
  {
    name: 'send-contact-message',
    description: 'Contact form delivery + audit log',
    // Invalid body: rejected by validation before any row is written or email sent.
    probe: { method: 'POST', body: { name: '', email: 'not-an-email', message: '' }, expect: [400] },
  },
  {
    name: 'ai-usage-check',
    description: 'Ask Savvy free-message quota',
    probe: { method: 'POST', expect: [401] },
    requiresAuth: true,
  },
  {
    name: 'admin-check',
    description: 'Owner admin verification',
    // Answers 200 {verified:false} to a caller without a valid user session.
    probe: { method: 'GET', query: '?organization_id=probe', expect: [200] },
    requiresAuth: true,
  },
  {
    name: 'admin-stepup',
    description: 'Password step-up for admin sessions',
    probe: { method: 'POST', expect: [401] },
    requiresAuth: true,
  },
  {
    name: 'ai-budget-suggest',
    description: 'AI budget recommendations',
    probe: { method: 'POST', expect: [401] },
    requiresAuth: true,
  },
  {
    name: 'ai-goal-coach',
    description: 'AI savings-goal coaching',
    probe: { method: 'POST', expect: [401] },
    requiresAuth: true,
  },
  {
    name: 'integrity-check',
    description: 'Cross-module data integrity audit',
    probe: { method: 'GET', query: '?organization_id=probe', expect: [401] },
    requiresAuth: true,
  },
  {
    name: 'smartscan-extract',
    description: 'Receipt / PDF statement extraction',
    probe: { method: 'POST', expect: [401] },
    requiresAuth: true,
  },
  {
    name: 'check-price-alerts',
    description: 'Watchlist alert checker',
    probe: null,
    scheduledReason: 'Runs on a schedule — invoking it would fire real alerts.',
  },
  {
    name: 'integrity-check-cron',
    description: 'Scheduled integrity sweep for every org',
    probe: null,
    scheduledReason: 'Runs on a schedule — invoking it would sweep every organization.',
  },
];

export const probeableFunctions = () => EDGE_FUNCTIONS.filter((f) => f.probe !== null);
export const scheduledFunctions = () => EDGE_FUNCTIONS.filter((f) => f.probe === null);
