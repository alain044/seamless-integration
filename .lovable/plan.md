## 1. Contact form — deliver to hakizimanaalainpacifique@gmail.com

- Keep the visible email `hello@savvyai.com` unchanged on `/contact`.
- Update phone shown to `+250 798 254 398`.
- Create edge function `send-contact-message` that:
  - Validates name/email/message with Zod.
  - Sends the email to `hakizimanaalainpacifique@gmail.com` (hard-coded recipient, with reply-to = submitter).
- For delivery I'll use **Lovable's built-in transactional emails** (`scaffold_transactional_email`). This requires a verified sender domain. If you don't have one yet, I'll open the email-setup dialog so you can configure one quickly (DNS may take time to verify, but the queue stores messages and sends once verified).
  - Alternative if you don't want to set up a domain: I can wire it to **Resend** or **Mailgun** via the standard connector instead. Tell me which you prefer.
- `Contact.tsx` form `handleSubmit` will invoke the edge function and show success/error toasts.

## 2. Login redirect loop

- Audit the post-login flow. Current flow: `AuthPage` calls `navigate('/dashboard')`, `ProtectedDashboard` checks `user` then `email_confirmed_at`. The likely cause: after sign-in the auth listener fires `INITIAL_SESSION` then `SIGNED_IN`, but `navigate` runs before state propagates → guard sees `!user` once and bounces to `/auth`. Fix:
  - In `AuthPage` signIn handler, await `supabase.auth.getSession()` after `signInWithPassword` succeeds, then `navigate('/dashboard', { replace: true })`.
  - In `AuthRoute`, also gate on `loading` to avoid a flash redirect.
  - Verify `localStorage` persistence is enabled (it is in `client.ts`).
- Will repro and confirm fix via preview.

## 3. Password reset flow

- `/reset-password` page already exists and uses `supabase.auth.updateUser({ password })`. I'll harden it:
  - Confirm route is public (it is).
  - Require an active recovery session before allowing submit (already checked).
  - Add token-expiry handling: if `getSession()` returns null and URL has no `type=recovery`, show "Link expired — request a new one" with a button back to `/auth?mode=forgot`.
  - Server-side, Supabase Auth hashes passwords (bcrypt) automatically — no extra work needed for hashing; will state this in the UI copy.
  - Add password-strength enforcement (already partly done) and disallow reusing the current password by attempting `signInWithPassword` then surfacing message if same.

## 4. Ask Savvy AI message limit → DB

- New table `ai_message_usage`:
  - `user_id uuid PK references auth.users(id)`, `count int default 0`, `window_start timestamptz default now()`, `updated_at`.
  - RLS: user can select/update own row.
- Edge function `ai-usage-check` (or inline in existing `finance-chat`):
  - Before responding, fetch the user's row.
  - If `now() - window_start >= 12h`, reset `count = 0, window_start = now()`.
  - If `count >= FREE_LIMIT`, return 429 with `retry_after_seconds`.
  - Else increment `count`.
- `Chat.tsx`:
  - Remove `localStorage` count.
  - Read remaining count from a small RPC or from the function's response headers.
  - Show "Limit reached — resets in Xh Ym".
- Anonymous users: keep current localStorage preview behavior (cannot persist without a user). Confirm if you'd like anonymous users blocked entirely instead.

## Open question before I start

For the contact form delivery (item 1), which do you prefer?
- **A.** Lovable built-in transactional email (requires verifying a sender domain).
- **B.** Resend connector.
- **C.** Mailgun connector.

Reply with A / B / C and I'll implement everything.
