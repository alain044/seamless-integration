## Scope

Six related changes. Grouping for clarity:

### 1. Tasks: amount optional
- `src/pages/TasksPage.tsx`: remove required validation on amount; allow blank → null on insert.

### 2. Expenses ↔ Budgets sync
When a user adds an expense whose `category` matches an existing budget category, increment that budget's `spent`. When updated/deleted, adjust accordingly.
- Implement via a Postgres trigger on `expenses` (INSERT / UPDATE / DELETE) that updates `budgets.spent` for the matching `(user_id, category)`. This keeps it consistent regardless of client.
- Backfill existing data once: recompute `budgets.spent` from current expenses.

### 3. Profile picture auto-crop
- `src/pages/SettingsPage.tsx` avatar upload: before upload, draw image to a square canvas (center-crop, resize to 512×512, export as JPEG ~0.9). Upload the cropped blob instead of the raw file. No UI cropper needed — fully automatic.

### 4. Dashboard with real data
- `src/pages/Index.tsx`: replace mocked numbers. Fetch from Supabase:
  - Total balance = sum(income) − sum(expense) from `expenses`
  - Monthly income/expense (current month)
  - Budgets summary (sum spent / sum limit)
  - Savings progress (sum saved / sum target)
  - Recent transactions (latest 5 expenses)
  - Spending by category for chart
- Update `RecentTransactions` and `SpendingChart` to accept props (or fetch themselves).

### 5. Reports as PDF
- `src/pages/ReportsPage.tsx`: add "Export PDF" button using `jspdf` + `jspdf-autotable`. Generate a PDF with org name, date range, expenses table, totals, and budget summary.

### 6. Step-up auth for Admin (owner only)
- New route `/dashboard/admin` — owner-only, requires fresh step-up verification.
- New route `/dashboard/admin/verify` — second auth step (re-enter password; owners with TOTP enrolled use TOTP code instead).
- DB:
  - `admin_sessions` table: `id, user_id, organization_id, verified_at, expires_at` (15-min TTL). RLS: own rows only. Insert via edge function only.
  - `admin_access_log` table: `id, user_id, organization_id, action, success, ip, user_agent, created_at`. RLS: owners view own org rows; insert by service role.
- Edge function `admin-stepup` (verify_jwt = true in code):
  - Validates JWT, checks role = owner via `has_role`.
  - Accepts `{ password }` or `{ totp_code }`. Verifies password via `supabase.auth.signInWithPassword` server-side using the user's email; or verifies TOTP via `auth.mfa.challengeAndVerify`.
  - On success: inserts `admin_sessions` row with 15-min expiry; inserts success row in `admin_access_log`. Returns `{ session_id, expires_at }`.
  - On failure: logs failure; returns 401.
- Edge function `admin-check`: returns whether caller has a non-expired admin session.
- Frontend:
  - Add "Admin" item in sidebar (visible to all; click handler does the role check + redirect).
  - `AdminGuard` component wraps `/dashboard/admin/*`: calls `admin-check`; if not verified → redirect to `/dashboard/admin/verify`.
  - `/dashboard/admin/verify` page: password (or TOTP) form → calls `admin-stepup`. On success → navigate to `/dashboard/admin`.
  - `/dashboard/admin` placeholder admin dashboard (org member list, recent audit log entries, basic stats).
  - On `signOut`, clear local admin session marker.
- Security: server-side enforced role + verification check; verification expires automatically; all attempts logged.

## Technical notes

- Migrations: trigger function for expense→budget sync (SECURITY DEFINER, search_path=public), `admin_sessions`, `admin_access_log` with RLS.
- Edge functions: deployed automatically; CORS headers; Zod validation on input.
- New deps: `jspdf`, `jspdf-autotable`.
- No auth method changes for normal login flow.

## Out of scope

- Building a full-featured admin panel beyond a basic dashboard with member list + audit log.
- Manual avatar crop UI (request was "auto").
