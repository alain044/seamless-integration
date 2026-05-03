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
- Both use the **Lovable AI Gateway** (`google/gemini-2.5-flash`) — no separate API key needed.

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
| `LOVABLE_API_KEY` | `finance-chat`, `ai-insights` | Lovable AI Gateway access (auto-provisioned) |
| `MARKET_API_KEY` *(optional)* | `market-quotes` | Premium quote provider |
| `EXCHANGE_API_KEY` *(optional)* | `exchange-rates` | Premium FX provider |

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
/auth             /dashboard/portfolio
/reset-password   /dashboard/market
                  /dashboard/ai-insights
                  /dashboard/analytics
                  /dashboard/notifications
                  /dashboard/status
                  /dashboard/settings
```

`/dashboard/*` is protected by three gates:
1. **`ProtectedDashboard`** — must be signed in.
2. **`VerifyEmailGate`** — email must be confirmed.
3. **`OrgGate`** — user must belong to (or onboard) an organization.

---

## Backend & edge functions

| Function | Verb | Purpose |
|---|---|---|
| `finance-chat` | POST | Streaming public finance Q&A |
| `ai-insights` | POST | Streaming personalized advisor (portfolio + finance) |
| `market-quotes` | POST | Live stock quotes for a list of symbols |
| `exchange-rates` | GET  | FX rates for the user's base currency |
| `check-price-alerts` | scheduled | Background watchlist alert checker |

All five are monitored at `/dashboard/status` with latency and one-click retry.

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
