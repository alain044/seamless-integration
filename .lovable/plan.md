## 1. Support email delivery + DB log

**Root cause:** sending from `onboarding@resend.dev` to a non-owner Gmail is silently dropped by Resend in many cases, and we have no record of the attempt.

**Fix:**
- New table `support_messages` (name, email, phone, message, status, error, created_at) — RLS so only owners can read; anyone can insert via edge function (service role).
- `send-contact-message` edge function:
  - Insert row first with status `pending`.
  - Send via Resend → on success update `sent`, on failure store `error` and return 502 but row is preserved.
- Set up Lovable Emails domain (presented via setup dialog) so we can send from a verified sender to any inbox. Until DNS is verified, messages are still captured in DB.
- Admin dashboard gets a "Support Inbox" panel listing all messages with status badges.

## 2. Contact info — two phone numbers

- Restore previous phone field; add `phone2` column on `profiles`.
- Public Contact page shows both numbers (`+250 798 254 398` and the restored prior number — please confirm the exact second number in chat or I'll use a placeholder you can edit in Settings).
- Settings page lets owner edit both.

## 3. Admin portal: owner-only + audio briefings

- Already owner-gated via `AdminGuard`; tighten by re-checking server-side in `admin-check` (already done) and removing any non-owner UI entrypoints.
- New table `audio_briefings` (owner_id, org_id, title, audio_path, created_at) + `audio_briefing_recipients` (briefing_id, user_id, listened_at).
- Storage bucket `briefings` (private) with RLS: owner uploads; recipients can read their own.
- Admin page gets a "Briefings" tab:
  - Record in-browser (MediaRecorder API) **and** file upload fallback.
  - Pick recipients from org members (multi-select).
- Recipients see a "Briefings" item in sidebar with playable list + unread badge.

## 4. Member collaboration workspace (realtime org chat)

- New table `org_messages` (org_id, user_id, body, created_at) with RLS limited to org members.
- Enable realtime publication.
- New page `/dashboard/collaborate` with channel list (one per org for now), message stream, composer.
- Sidebar entry "Collaborate".

## 5. Data persistence audit

- Audit pages: Expenses, Budgets, Savings (already DB), Tasks, Portfolio/Holdings, Watchlist, Price alerts, Notifications, Settings — confirm all CRUD hits DB, no localStorage-only state for owned data.
- Budget ↔ expenses sync already handled by `expenses_sync_budget` trigger; extend to savings goals when expense category = "Savings".

## 6. Auth improvements

- **Login 2FA via email code:**
  - New table `login_otps` already exists (good). Edge function `login-otp-send` generates 6-digit code, stores hashed, emails via Resend.
  - After password sign-in succeeds, sign user out temporarily, prompt for code, then re-sign-in via `verifyOtp` flow (or maintain a `verified_login_sessions` table and gate dashboard on it).
  - Simplest secure path: use Supabase's built-in email OTP — call `signInWithOtp` after password as a second factor, verify, then allow dashboard. I'll implement this path.
- **Post-verification redirect:** update `emailRedirectTo` to `/auth?verified=1`; AuthPage shows "Email verified — please log in" toast.

## 7. Expense categories

- Move from free-text to enum-backed dropdown. Predefined list (~30): Food & Dining, Groceries, Transport, Fuel, Utilities, Rent, Mortgage, Internet, Phone, Insurance, Healthcare, Education, Childcare, Entertainment, Subscriptions, Shopping, Clothing, Personal Care, Gifts, Donations, Travel, Hotels, Taxes, Fees, Savings, Investments, Business, Office, Software, Other.
- Backward compatible: existing rows keep their text values; new entries pick from list (with "Other" + free text fallback).
- Budgets page uses same list.

## 8. Technical notes

- All new tables get GRANTs + RLS + updated_at triggers.
- New edge functions: `audio-briefing-notify`, `login-otp-send`, `login-otp-verify` (or use Supabase native OTP).
- Use Lovable Cloud storage for audio.
- Realtime via `supabase.channel`.

## What I need from you

1. **Second phone number** to restore (or I'll add it as empty for owner to fill).
2. **Confirm email domain setup** — I'll show the dialog; without DNS, support messages are still captured in the database and visible in admin, but won't reach Gmail until verified.

I'll proceed with everything else on approval.
