# Implementation Plan

This is a very large request. To ship it safely without breaking the existing app, I'll build it in **4 phases**, each independently testable. Confirm the phase order (or pick a subset) before I start.

## Phase 1 — Foundations (data + access)

**Goal:** lock down admin, normalize categories everywhere, and add the schema the rest of the work depends on.

- **Owner-only Admin enforcement**
  - Already gated by `AdminGuard` + server-side `admin-check`. Add the exact "Unauthorized Access: You do not have permission to access administrative resources." copy. Audit sidebar/menus to make sure no admin link renders for non-owners.
- **Category normalization service** (`src/lib/categoryNormalizer.ts`)
  - Alias map → standardized `EXPENSE_CATEGORIES`. Applied in: manual expense entry, SmartScan import, budgets, reports, AI insights prompts.
  - DB trigger `expenses_normalize_category` runs the same map server-side as a safety net.
- **New tables**
  - `recurring_expenses` (detected subscriptions)
  - `goal_progress_history` (snapshot per update)
  - `collab_cases`, `collab_case_messages`, `collab_case_attachments`, `collab_case_assignees` (cases workflow)
  - `briefing_events` (assigned / received / first_play / last_play / completed timestamps + progress %)
  - `integrity_reports` (output of persistence checks)
- All new tables: GRANTs + RLS scoped to org membership / `auth.uid()`, `updated_at` triggers.

## Phase 2 — SmartScan AI + AI Budgeting/Goals/Insights

- **SmartScan AI**
  - Storage bucket `receipts` (private, per-user folder).
  - Edge function `smartscan-extract`: accepts uploaded file URL, calls Lovable AI (`google/gemini-2.5-pro` for PDFs/images — multimodal) to extract `{ date, merchant, amount, currency, category, line_items[], is_recurring }`, normalizes category, inserts into `expenses`, flags recurring into `recurring_expenses`.
  - UI: new "Scan receipt" button on Expenses page → upload modal → preview extracted fields → save (editable).
- **AI Budget recommendations**
  - Edge function `ai-budget-suggest`: reads last 3 months of expenses, returns suggested monthly amount per category + rationale. UI button in Budgets.
  - Overspend alerts via `notifications` insert when `spent/limit > 0.9` (trigger).
- **AI Goals coach**
  - Edge function `ai-goal-coach`: per goal, returns weekly required savings + tips.
  - `goal_progress_history` rows on every update; chart on goal detail.
- **AI Insights page upgrade**
  - Single edge function `ai-insights` returns: spending analysis, forecast (next 30d), savings opportunities, cash-flow prediction, health score. Render as cards.

## Phase 3 — Voice Briefings v2 + Collaboration Center

- **Voice Briefings**
  - Extend `audio_briefing_recipients` with `first_played_at`, `last_played_at`, `completed_at`, `progress_seconds`.
  - Recipient player: play / pause / resume / 15s skip / seek bar / replay; emits events to `briefing_events` + updates recipient row.
  - Owner "Shared With" panel: per-briefing table of recipients with delivery / listening / completion badges.
  - Notifications on assign / first play / completion (DB triggers → `notifications`).
- **Collaboration Center (cases)**
  - Replace simple chat with **cases** workflow: list, create, assign, mention (@user), threaded messages, attachments (bucket `collab-files`), status (`open`/`in_progress`/`pending_review`/`resolved`/`closed`), activity log.
  - Realtime via `supabase.channel` on `collab_case_messages` and `collab_cases`.
  - Existing `org_messages` chat kept as a "General" channel inside the Center.

## Phase 4 — Persistence & Sync verification

- Edge function `integrity-check` (cron-friendly) runs per-org checks:
  - Expenses ↔ budgets `spent` rollup matches.
  - Goal `saved` matches sum of `goal_progress_history`.
  - Briefing recipients have consistent event timestamps.
  - Support messages have no `pending` older than 1h.
  - Logs results to `integrity_reports`.
- Admin tab "Integrity" shows latest report + "Run now" button.
- Persistence is already DB-backed (no localStorage for owned data); I'll audit and remove any stragglers found.

## Dashboard

The current dashboard already covers balance, income, expense, savings, charts, and recent transactions. I'll add **Budget utilization** strip (top 3 budgets with progress bars) and a **Cash flow** mini-chart (income vs expense, last 6 months) — non-breaking additions.

## What I need from you

1. **Phase order** — ship Phase 1 first (foundations), then 2 → 3 → 4? Or prioritize a specific phase (e.g., SmartScan first)?
2. **SmartScan model** — default to `google/gemini-2.5-pro` (best multimodal for receipts). OK?
3. **Collaboration cases** — replace the current org chat page with the cases workflow, or keep chat and add cases as a sibling tab?

Reply with the order (or "go all phases in order") and I'll start.