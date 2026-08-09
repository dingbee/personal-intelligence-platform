# ARRIYIA Password Recovery Flow — Hotfix v1

Post-10/10, password-recovery completion hotfix. Baseline: `dingbee/personal-intelligence-platform` @ `main`, `1c6f020` (Phase 5.1 — Auth & Transactional Email Reliability, SMTP confirmed working).

## 1. Discovery — why the link landed at `/`

Traced the full path before changing anything:

- **`ForgotPasswordPage.tsx` → `AuthContext.sendPasswordReset`** — already called `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })`. The redirect target was already correctly computed, unhardcoded, and origin-derived — no code defect here.
- **`/reset-password`** — already registered in `router.tsx` as a public route (not wrapped in `ProtectedRoute`), rendering `ResetPasswordPage`. Nothing in that page (or anywhere else in the app) redirects away from it on mount — confirmed by reading the full component; it had no session check at all, so it *would* have rendered if reached.
- **`src/shared/lib/supabase.ts`** — client created with no `detectSessionInUrl`/`flowType` overrides, so the library default (`detectSessionInUrl: true`) applies: on page load, the client automatically parses recovery tokens out of the URL and establishes a session, firing `onAuthStateChange` with a `PASSWORD_RECOVERY` event. No client-config defect.

Since the code-level redirect target was already correct and nothing in-app would bounce a user away from `/reset-password`, **the most likely explanation for landing at the bare origin is external**: Supabase Auth's Redirect URL allowlist (Project Settings → Authentication → URL Configuration → Redirect URLs) very likely does not include `https://nolmark.co/reset-password`. When `redirectTo` isn't an allowed URL, GoTrue silently substitutes the plain Site URL instead of erroring — which reproduces exactly the reported symptom. **This could not be confirmed directly**: there is no tool in this session that reads Supabase's Redirect URL allowlist, and outbound HTTPS to Supabase's public API from this sandbox is blocked (same capability boundary hit during the SMTP investigation). See §5 for the exact external action needed.

Independent of that external question, a second, real, code-level gap existed and is fixed in this hotfix regardless: **`AuthContext` never distinguished a `PASSWORD_RECOVERY` session from a normal one**, and `ResetPasswordPage` never checked for a session before rendering a form (or verified one existed at all) — it would have called `updateUser` unconditionally, including with no session present, and on success it silently navigated straight into the app (`/library`) rather than confirming the change and returning the user to login. Both gaps are closed below.

## 2. Implementation — smallest change consistent with existing architecture

**No new route.** `/reset-password` already existed, was already public, and was already the correct semantic destination — reused per the explicit instruction not to duplicate an appropriate existing route.

### `src/modules/auth/context.ts`
Added `passwordRecovery: boolean` to `AuthContextValue` — true from the moment a `PASSWORD_RECOVERY` event fires until sign-out or a successful password update, so a page can distinguish "arrived via a recovery link" from "already normally logged in."

### `src/modules/auth/AuthContext.tsx`
- `onAuthStateChange` now branches on `event`: sets `passwordRecovery` true on `PASSWORD_RECOVERY`, false on `SIGNED_OUT` (session/loading handling for every other event is unchanged).
- `updatePassword` now clears `passwordRecovery` on a successful update.
- No changes to `signInWithPassword`, `signUpWithPassword`, `signInWithMagicLink`, `signOut`, or the beta-invite gate — all untouched.

### `src/modules/auth/pages/ResetPasswordPage.tsx` (rewritten, same route/component, no new file)
Now implements the full flow the task specified:
- **Loading state** — a spinner while Supabase resolves the recovery session from the URL (matches `ProtectedRoute`'s existing loading pattern).
- **Invalid/expired-link state** — once loading resolves, if there's no session, shows "This link is no longer valid" with a link to `/forgot-password`, instead of presenting a form that would just fail.
- **Form state** — new password + confirm password fields (reusing the existing `Input`/`Button` components, same `minLength={8}`/`required` policy `SignUpPage` already uses — no new password-policy rules introduced), client-side mismatch validation before ever calling `updatePassword`, ARRIYIA identity via `appConfig.productName` in the subtitle, heading reads "Set a new password" exactly as specified.
- **Success state** — "Password updated" confirmation with an explicit "Back to login" link, replacing the previous behavior of silently navigating into `/library`. This matches the requested flow (`success confirmation → user returns to login`) rather than leaving the user signed in on a recovery-scoped session.
- **Error state** — a failed `updateUser` call shows the message `AuthContext.updatePassword` returns (Supabase's own sanitized auth error text, e.g. "Password should be at least 6 characters" — the same convention every other auth page in this app already uses; no raw stack trace or internal detail is ever shown).

## 3. Recovery-session handling

- The page gates on `session` presence (post-`loading`) to decide form vs. invalid-link state — this is what actually prevents `updateUser` from being attempted with no valid session.
- `passwordRecovery` (context-level) is the precise signal for *how* that session was established, tested directly against the real `PASSWORD_RECOVERY` event rather than inferred.
- Expired/invalid/already-consumed links all collapse to the same state: no session present once loading resolves → the same recoverable error, with a path back to request a new link. No raw Supabase error text is shown in this state (it's a generic, honest message, not a passthrough of whatever Supabase would have said).

## 4. Authentication integrity — confirmed unchanged

Verified by diff, not assumed: `git diff --stat` touches exactly 4 files (`context.ts`, `AuthContext.tsx`, `ResetPasswordPage.tsx`, `AuthContext.test.ts`) plus one new test file (`ResetPasswordPage.test.ts`). Untouched: `router.tsx`, `ProtectedRoute.tsx`, `LoginPage.tsx`, `SignUpPage.tsx`, `ForgotPasswordPage.tsx`, `signUpWithPassword`/beta-gate logic, `signOut`'s query-cache-clearing (Phase 5), `signInWithMagicLink`, any migration/RLS/Edge Function/SMTP/domain configuration.

## 5. External action required — not performed, documented instead

**Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.** Add (if not already present):

```
https://nolmark.co/reset-password
```

This is the most likely root cause of the reported "lands at `/`" behavior (§1) and is the one piece of this hotfix that genuinely requires an external, human action — there is no API surface available to this session to read or write it. No other Supabase Auth setting needs to change; SMTP (fixed in the prior turn) is untouched.

## 6. Testing

New/updated, all deterministic, no fragile timing:

- **`src/modules/auth/AuthContext.test.ts`** (additions):
  - `sendPasswordReset` — asserts `resetPasswordForEmail` is called with `redirectTo: '${origin}/reset-password'`.
  - `passwordRecovery` — asserts it flips true on a simulated `PASSWORD_RECOVERY` event and resets false on `SIGNED_OUT`.
  - `updatePassword` — asserts `updateUser` is called with the new password, a Supabase error is surfaced without throwing, and `passwordRecovery` clears on success.
- **`src/modules/auth/pages/ResetPasswordPage.test.ts`** (new): loading state renders a spinner and no form; no-session state renders the invalid-link message with a working link to `/forgot-password`; a valid session renders both password fields; mismatched passwords are rejected client-side without calling `updatePassword`; matching passwords call `updatePassword` with the exact value entered; a successful update shows "Password updated" with a working link back to `/login`; a failed update shows the returned error text with no success state shown.
- **Existing login/signup/beta-gate tests** — unchanged, still passing (see §7 counts).

## 7. Verification Gate

```text
tsc -b       ✅
vitest run   ✅  240/240 test files, 1886/1886 tests (13 new)
oxlint       ✅
vite build   ✅  (bundle size unchanged within noise; same pre-existing chunk-size warning)
```

## 8. Live verification — not performed, and why

Phase 8 of this task calls for triggering a real password reset, opening the actual email, clicking the link, and completing the flow live. **This could not be performed from this session**: there is no browser, no mailbox access, and (as established during the SMTP investigation) outbound HTTPS from this sandbox to Supabase's public API is blocked — the same limitation that prevented a self-triggered test earlier in this engagement. This is stated plainly rather than claimed.

What *can* be said with confidence: the code-level gaps that would have blocked this flow even with a correct redirect (no recovery-session detection, unconditional form, silent redirect into the app on success) are fixed and covered by deterministic tests. The one remaining unknown is whether `https://nolmark.co/reset-password` is in Supabase's Redirect URL allowlist (§5) — once that's added (or confirmed already present), a real end-to-end test (request reset → click email link → land on "Set a new password" → update → "Password updated" → log in with the new password) is the correct way to close this out, the same way the SMTP fix was verified against live Auth logs in the prior turn.

## 9. Remaining Manual Action

Exactly one item, stated precisely per the task's instruction:

**Supabase Dashboard → Authentication → URL Configuration → Redirect URLs → add `https://nolmark.co/reset-password`** (if not already present). No secret involved. No other dashboard change is needed for this hotfix.
