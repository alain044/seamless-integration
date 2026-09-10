# Savvy — Personal Finance + Investment Suite

Savvy is a unified web application that combines a marketing landing experience, a public finance Q&A chatbot ("Ask Savvy"), and a full multi-organization finance dashboard (expenses, budgets, savings, portfolio, market data, AI insights, tasks, settings).

It is built on **React + Vite + TypeScript + Tailwind**, with **Lovable Cloud (Supabase)** providing auth, database, RLS, real-time, storage, and edge functions.

---

## Table of contents

1. [Feature overview](#feature-overview)
2. [Tech stack](#tech-stack)
3. [Installation](#installation)
4. [Environment configuration](#environment-configuration)
5. [Routes](#routes)
6. [Backend & edge functions](#backend--edge-functions)
7. [Authentication & 2FA](#authentication--2fa)
8. [Localization](#localization)
9. [Troubleshooting](#troubleshooting)

---

## Feature overview

### Public

- **Landing / Features / About / Contact** — marketing site at `/`, `/features`, `/about`, `/contact`.
- **Ask Savvy (`/chat`)** — public, streaming finance assistant. Free preview: **8 messages** for unauthenticated users, then a sign-up wall.
- **Auth (`/auth`)** — Email + password and Google OAuth, with a **"Back to Homepage"** link, password reset, TOTP 2FA, and per-login email OTP.

### Private dashboard (`/dashboard/*`)

| Route | Purpose |
|---|---|
| `/dashboard` | Stats + recent activity overview |
| `/dashboard/expenses` | Expense tracking |
| `/dashboard/budgets` | Budget planning |
| `/dashboard/savings` | Savings goals |
| `/dashboard/tasks` | Org tasks with **owner-approval workflow** |
| `/dashboard/portfolio` | Holdings & allocation |
| `/dashboard/market` | Live quotes / market data |
| `/dashboard/ai-insights` | Streaming Savvy Insights advisor |
| `/dashboard/analytics` | Spending analytics |
| `/dashboard/notifications` | Alerts & notifications |
| `/dashboard/status` | Edge-function health-check + retries |
| `/dashboard/settings` | Profile, organization, 2FA, members |

### Organizations

- Multi-org membership; switch via the org switcher in the dashboard header.
- Roles: `owner`, `accountant`, `analyst`, `viewer`.
- Owner can invite/remove members, change roles, and **approve completed tasks**.

### Task workflow

`pending → in_progress → completed (awaiting approval) → approved`

A task marked Completed is **not closed** until the org **owner** clicks **Approve**. The owner can also revoke approval.

### AI

- **Ask Savvy** (`finance-chat`) — concise, finance-only Q&A, streamed.
- **Savvy Insights** (`ai-insights`) — combines portfolio + finance snapshot, supports receipts/PDF context.
- Both use the **Lovable AI Gateway** — no separate API key needed. `finance-chat`,
  `ai-insights`, `ai-budget-suggest` and `ai-goal-coach` run `google/gemini-2.5-flash`;
  `smartscan-extract` runs `google/gemini-2.5-pro` for document OCR.

---

## Tech stack

- React 18, Vite 5, TypeScript 5
- Tailwind CSS v3 + shadcn/ui
- React Router v6
- TanStack Query
- i18next (8 languages)
- Lovable Cloud (Supabase) — Postgres, Auth, RLS, Realtime, Edge Functions

---

## Installation

```bash
# Install dependencies
bun install

# Start the dev server
bun run dev
```

The app is also editable directly on [Lovable](https://lovable.dev) — no local install required.

---

## Environment configuration

Lovable Cloud auto-provisions `.env`. The only variables consumed by the client are:

```ini
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

Server-side secrets (set in Cloud → Secrets, never in `.env`):

| Secret | Used by | Purpose |
|---|---|---|
| `LOVABLE_API_KEY` | `finance-chat`, `ai-insights`, `ai-budget-suggest`, `ai-goal-coach`, `smartscan-extract`, `send-contact-message` | Lovable AI Gateway access (auto-provisioned) |
| `RESEND_API_KEY` | `send-contact-message` | Contact-form delivery |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | all functions | Injected by the platform |

`market-quotes` (Yahoo Finance) and `exchange-rates` (open.er-api.com) use
public, key-less endpoints — neither needs a secret. Functions read secrets with
`Deno.env.get(...)`.

---

## Routes

```
Public            Private (auth + verified email + org)
─────────         ────────────────────────────────────
/                 /dashboard
/features         /dashboard/expenses
/about            /dashboard/budgets
/contact          /dashboard/savings
/chat             /dashboard/tasks
/auth             /dashboard/reports
/reset-password   /dashboard/portfolio
                  /dashboard/market
                  /dashboard/ai-insights
                  /dashboard/analytics
                  /dashboard/notifications
                  /dashboard/status
                  /dashboard/collaborate
                  /dashboard/briefings
                  /dashboard/settings
                  /dashboard/admin            ← owner/admin only
                  /dashboard/admin/verify
```

`/login` and `/signup` redirect to `/auth`; `/dashboard/finance-advisor` and
`/dashboard/portfolio-advisor` redirect to `/dashboard/ai-insights`.

`/dashboard/*` is protected by four gates:
1. **`ProtectedDashboard`** — must be signed in.
2. **`VerifyEmailGate`** — email must be confirmed.
3. **`OrgGate`** — user must belong to (or onboard) an organization.
4. **`MfaGate`** — a verified TOTP factor is required. New accounts get a 7-day
   grace period, during which the dashboard renders behind an amber banner.

`/dashboard/admin` additionally passes **`AdminGuard`**.

---

## Backend & edge functions

| Function | Verb | Purpose |
|---|---|---|
| `finance-chat` | POST | Streaming public finance Q&A |
| `ai-insights` | POST | Streaming personalized advisor (portfolio + finance) |
| `ai-budget-suggest` | POST | AI budget recommendations from spend history |
| `ai-goal-coach` | POST | AI savings-goal coaching |
| `ai-usage-check` | POST | Ask Savvy free-message quota |
| `market-quotes` | GET | Live quotes + symbol search (Yahoo Finance, key-less) |
| `exchange-rates` | GET | FX rates for the user's base currency (key-less) |
| `smartscan-extract` | POST | Receipt / PDF statement extraction |
| `send-contact-message` | POST | Contact-form delivery + audit log |
| `admin-check` | GET | Verify the caller is an org admin |
| `admin-stepup` | POST | Password step-up for admin sessions |
| `integrity-check` | GET | Cross-module data integrity audit for an org |
| `check-price-alerts` | scheduled | Background watchlist alert checker |
| `integrity-check-cron` | scheduled | Periodic integrity sweep for every org |

All fourteen are listed at `/dashboard/status` with latency and one-click retry.
The two scheduled functions are shown but never probed — invoking them would run
a real background job — and the auth-gated ones treat `401` as the healthy
answer, so a health check never costs money or mutates data.

The client-side registry lives in `src/lib/edgeFunctions.ts` and is the single
source of truth for that page; `src/test/edgeFunctions.test.ts` fails if it
drifts from the function directories again.

---

## Authentication & 2FA

- **Email + password** and **Google OAuth** are the supported sign-in methods.
- **Email verification** is enforced before the dashboard is unlocked.
- **TOTP 2FA** can be enrolled in Settings (recovery codes supported).
- **Per-login Email OTP** — every password sign-in (without TOTP) sends a 6-digit one-time code via email that must be entered to complete the login.
- **Password reset** — request a reset link from `/auth → Forgot password?`. The link opens `/reset-password`, validates the recovery token, enforces strength, and signs the user out so they can re-sign-in with the new password.

---

## Localization

- 8 languages: `en`, `fr`, `es`, `pt`, `ar` (RTL), `zh`, `sw`, `rw`.
- Switching the language in the sidebar **applies instantly** across the entire app and **persists to `user_settings.preferences.language`** in the database, so the choice follows the user across devices and logins.

---

## Testing

```bash
bun run test          # vitest run
bun run test:watch    # watch mode
```

The suite runs in jsdom and takes a few seconds. What each file guards against:

| File | Failure mode it catches |
|---|---|
| `src/test/app-smoke.test.tsx` | The assembled app: that the route table actually renders and that the auth gate redirects a signed-out visitor off `/dashboard`. |
| `src/test/schema-consistency.test.ts` | A `select()` naming a column absent from the generated Supabase types — PostgREST would fail this silently at runtime. |
| `src/test/i18n-consistency.test.ts` | A locale missing keys, shipping a blank string, or dropping a `{{placeholder}}`; i18next falls back to English silently, so nothing else would notice. |
| `src/test/i18n-untranslated.test.ts` | A locale that defines every key but keeps the English sentence as its value — key parity alone proves a key *exists*, not that it was translated. |
| `src/test/codeSplitting.test.ts` | A page imported statically instead of through `lazy()` — Rollup folds it, and its heavy libraries, back into the entry bundle while the build still succeeds. |
| `src/test/securityLogLazy.test.ts` | A static `import` of `src/lib/securityLog.ts`, which pins it into the main bundle and makes the lazy chunk unsplittable. |
| `src/test/edgeFunctions.test.ts` | The System Status registry drifting from `supabase/functions/`. |
| `src/test/healthCheckPanel.test.tsx` | The status panel rendering anything other than the registry. |

**Windows:** run vitest through Node. `node_modules\.bin\vitest.cmd` fails with
`spawn EINVAL` on this setup:

```bash
node node_modules/vitest/vitest.mjs run
```

### Verifying a production build

Routes are code-split, so a broken chunk graph shows up as a blank page on one
route and nowhere else. After building, this fetches `index.html` and every
emitted chunk and fails if any is not served:

```bash
node node_modules/vite/bin/vite.js build
node node_modules/vite/bin/vite.js preview --port 4173 --strictPort
node dist-verify.mjs
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Edge function shows red on `/dashboard/status` | `LOVABLE_API_KEY` missing or AI credits exhausted | Check Cloud → Secrets / billing. Use the Retry button on the status page. |
| Can't reach `/dashboard` after signup | Email not yet verified | Click the link in the verification email, then hit "I've verified — refresh". |
| "Invalid or already used recovery code" | Code already consumed | Use your authenticator app or generate fresh recovery codes from Settings → 2FA. |
| OTP code never arrives | Wrong email or rate-limited | Click "Resend code" on the OTP step or use a different account. |
| Language reverts after logout | Old anonymous session — log in to re-apply persisted language | Sign in; persisted language is loaded from `user_settings`. |
| Members show as "Unknown user" | Profile row missing `full_name` and `email` | Ask the user to fill out Settings → Profile, or check the `profiles` table. |
| Tasks won't close | Awaiting owner approval | The org **owner** must click **Approve** on completed tasks. |

---

## License

Proprietary — © Savvy. All rights reserved.
