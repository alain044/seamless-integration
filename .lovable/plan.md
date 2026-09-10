# Platform Upgrade — Scoping & Sequencing

This request bundles ~10 distinct modules. Much of it is already shipped (SmartScan, Briefings v2, Collaboration cases, Integrity, AI Budget, AI Goal Coach, Admin owner-only guard). I want to confirm priorities before another large multi-file change so we don't regress what's working.

## Status of each item

| # | Module | Current state | Gap to close |
|---|---|---|---|
| 1 | SmartScan AI | Done (`smartscan-extract`, `SmartScanDialog`) | **Add**: duplicate detection + `smartscan_imports` audit table |
| 2 | 2FA | TOTP enrollment exists (`TwoFactorAuth.tsx`) — optional | **Mandatory enforcement** on every login (org policy + gate) |
| 3 | Session/security logs | `admin_access_log`, `settings_audit_log` exist | Add `security_events` (login, logout, failed login, pwd change, device) |
| 4 | Owner-only admin routes | Done (`AdminGuard` + `admin-check`) | Add explicit unauthorized-attempt log row |
| 5 | Audio Briefings | Done v2 (player, events, shared-with) | Verify; no new work unless gaps found |
| 6 | Collaboration Center | Cases done; org chat exists | Add @mentions parsing + mention notifications + search |
| 7 | Profile picture upload | `avatars` bucket exists | Debug failure, add validation, instant refresh |
| 8 | Contact form email | `send-contact-message` + DB log exists | Verify Resend delivery, add failure logging |
| 9 | Budget merge on duplicate | Currently allows duplicates | Upsert/merge by (user_id, category): sum limits |
| 10 | Ask Savvy greetings + finance-only | `finance-chat` exists | Update system prompt for greetings + topic guardrails |
| 11 | Admin financial CRUD | Owner-only today | Add `admin` role permission to expenses/budgets/goals via RLS using `has_role` |

## Proposed sequence (one phase per turn)

**Phase A — Data & policy (one migration)**
- `smartscan_imports` (audit) + dedupe index on `expenses (user_id, date, amount, name)`
- `security_events` table + GRANTs + RLS
- `org_security_policy` table (mfa_required boolean) — owners toggle
- Update RLS on `expenses`, `budgets`, `savings_goals`: allow org `admin` role full CRUD via `has_role`
- Unique-ish enforcement helper for budgets: merge logic in app + a UNIQUE `(user_id, category)` partial index after dedupe

**Phase B — Auth & security**
- 2FA enforcement gate in `AuthPage` / route guard: if org policy requires MFA and user has no verified factor → force enrollment screen before app access
- Login/logout/failed-login hooks → write to `security_events`
- Unauthorized admin attempt → insert into `security_events` from `AdminGuard`

**Phase C — Feature polish**
- SmartScan: pre-insert dedupe check + write to `smartscan_imports`
- Budgets: merge-on-duplicate (sum limit, re-sync spent)
- Ask Savvy: prompt update (greetings + finance-only)
- Contact form: surface delivery errors + persist failures
- Profile avatar: fix upload (mime/size validation, public URL refresh)
- Collaboration: @mention extraction → notifications, message search box

## Questions before I start

1. **MFA enforcement scope** — make it mandatory **globally for every user** (your wording), or **per-org toggle** owners control? Global is simpler but locks out existing users immediately on next login.
2. **Admin financial CRUD** — should org `admin`s edit **any member's** expenses/budgets/goals, or only their own + org-shared records? (Today everything is per-user.)
3. **Phase order** — start with Phase A (migration) now, or do you want a specific module first (e.g., fix avatar upload + contact form first since those are bugs)?

Pick answers and I'll execute phase by phase.
