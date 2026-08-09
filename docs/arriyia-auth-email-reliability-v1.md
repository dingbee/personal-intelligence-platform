# ARRIYIA Authentication & Transactional Email Reliability — v1

Post-10/10, Phase 5.1 (Authentication & Transactional Email Reliability). Baseline: `dingbee/personal-intelligence-platform` @ `main`, `0b07569` (Phase 5 — Application Hardening & App Experience).

## 1. Summary

**Status: PASS WITH HARDENING**, with one confirmed **P0 blocking password reset/magic-link delivery that requires an external Supabase Dashboard action** (not code-fixable) — see §4.

This phase had live, read-only access to the deployed Supabase project (`uzshazetfkjkrdnxwjtl`) via MCP tools — project logs, deployed Edge Function source, DB function definitions, and security advisors — which earlier phases explicitly documented as unavailable ("the sandboxed dev environment blocks outbound HTTPS to `*.supabase.co`," per `docs/feature-matrix.md` and `docs/pip-stabilization-intelligence-integration-v1.md`). That access surfaced one genuine, verified P1 defect (stale deployed Edge Functions, fixed this phase) and one genuine, live P0 (broken Auth SMTP, external fix required) that no prior phase could confirm from source alone.

## 2. Login

**Original issue as described:** hanging spinner / `TypeError: t is not a function` / failed `signInWithPassword`.

**Investigation:** Full trace of `LoginPage.tsx` → `AuthContext.signInWithPassword` → `supabase.auth.signInWithPassword` → `onAuthStateChange` → `ProtectedRoute`. No structural defect found: the flow correctly awaits the call, sets/clears a `submitting` flag, and surfaces `error.message` via a `role="alert"` element. `@supabase/supabase-js` appears at a single, non-duplicated version (`2.110.8`) in `package-lock.json`, ruling out an SDK version-mismatch class of bug.

**Live evidence (Supabase Auth logs, last 24h, project `uzshazetfkjkrdnxwjtl`):** multiple successful password logins for a real account (`dan@nolmark.co`, `login_method: password` then repeated `token_revoked`/refresh cycles — normal session lifecycle), plus a cluster of `400 Invalid login credentials` responses from the same IP shortly before those successes — consistent with normal wrong-password retries immediately preceding a correct one, not a systemic failure. No `500`, no unexpected-exception class error, and no evidence of a hang appears anywhere in the auth logs for `/token`.

**Root cause:** not reproduced. No defect found in this environment. Real, current production logins are succeeding. If the described error was real, it did not leave a trace in the last 24h of Auth logs and does not correspond to any structural issue found in the code — most consistent with either a since-resolved transient issue or a client-side condition (e.g., a stale cached bundle from before a deploy) that Phase 5's new `AppErrorBoundary`/`RouteErrorBoundary` (already shipped in `0b07569`) will now catch and surface with a working reload action instead of a silent failure, if it recurs.

**Fix:** none applied — no reproducible root cause found to fix. **Verification:** live Auth logs reviewed directly; no further action taken.

## 3. Signup & Beta Invitation Gating

**Investigated live** (query against the deployed database, not just source):

- `is_beta_invited(check_email)` — confirmed via `pg_get_functiondef`: case-insensitive `lower(email) = lower(check_email) AND status = 'invited'` existence check. Correct.
- `assign_default_plan()` (the `auth.users` insert trigger) — confirmed: resolves the invited plan (falling back to the `beta` plan), inserts the plan assignment, seeds `quota_usage` rows from `plan_quotas`, and marks the invite `accepted` with `accepted_at`/`accepted_by`. Correct, and matches `AuthContext.tsx`'s two-layer gate design (client-side `is_beta_invited` RPC for UX, server-side `enforce_beta_invite_gate` `BEFORE INSERT` trigger from `0034_beta_invite_quota_repair.sql` as the real, unbypassable gate).
- Duplicate-invite handling: `admin_create_beta_invite` returns `outcome='duplicate'` on a case-insensitive email match rather than erroring or creating a second row.
- Non-invited signup: rejected server-side by the `enforce_beta_invite_gate` trigger regardless of client behavior — confirmed by reading its logic in `0034`, not merely assumed.

**No defect found. No change made.** The beta gate was not weakened, bypassed, or otherwise touched, per this phase's explicit constraint.

## 4. Transactional Email

Reported separately, per the required format:

### Beta invitations — **fixed (P1), redeployed**

**Defect found (verified live, not from source):** the *deployed* `send-beta-invitation` Edge Function (version 3, last touched before the Phase 2 ARRIYIA rebrand) still sent an email reading **"You're invited to the NOVA beta"** with "NOVA" in the header and body — even though the *repository source* had already said "ARRIYIA" since Phase 2 (commit `4fd6527`). The function was simply never redeployed after that rebrand. This is a real, live branding defect: any beta invitation sent before this phase would have shown "NOVA" to a real recipient, contradicting the approved identity.

**Fix:** redeployed `send-beta-invitation` from the current (already-correct) repository source — version 3 → **4**. Confirmed post-deploy by re-fetching the live function source: now reads "You're invited to the ARRIYIA beta" throughout. Also added one line of server-side `console.error` logging on a Resend rejection (previously the only record of a failed send was the HTTP response returned to the caller — nothing was logged for later diagnosis).

### Workspace invitations — **fixed (P1), redeployed**

**Same defect, same fix.** Deployed `send-workspace-invitation` (version 9) still read `` `${inviterName} invited you to ${workspaceName} on NOVA` `` with "NOVA" in the header and footer text. Redeployed from current source — version 9 → **10**. Confirmed post-deploy: now reads "...on ARRIYIA" throughout. Same logging addition applied.

### Password/reset emails — **broken (P0), external fix required**

Supabase Auth's own transactional email (used for `/recover` — password reset — and `/magiclink`) is failing in production. Live Auth logs show:

```
error: "535 \"Authentication credentials invalid\""
path: "/recover"    status: 500
path: "/magiclink"  status: 500
```

`535` is an SMTP authentication-failure code — Supabase Auth's configured SMTP credentials (Auth → Email Templates / SMTP Settings in the Supabase Dashboard) are invalid or expired. This is **not** the Resend-based `send-beta-invitation`/`send-workspace-invitation` path — it's Supabase's separate, built-in Auth email sender, entirely outside this repository's code. `ForgotPasswordPage.tsx` already handles this correctly on the frontend (the `{ error }` returned by `sendPasswordReset` is surfaced via a visible `role="alert"` message, not swallowed) — the defect is purely the external SMTP configuration, not application code. **See §14 (External Actions Required).**

### Other transactional emails

No other transactional email paths exist in this codebase — signup itself relies on Supabase's default (no separate confirmation-email Edge Function), and no other notification/email system was found.

## 5. Resend

- **Configuration status:** both invitation functions correctly read `RESEND_API_KEY`/`RESEND_FROM_EMAIL`/`SITE_URL` from `Deno.env` (Supabase Function secrets, not repo-committed — correct pattern). No secret value was read, printed, or logged at any point in this phase.
- **Sender status:** `RESEND_FROM_EMAIL` falls back to Resend's own sandbox address (`onboarding@resend.dev`) if unset. Whether a real, branded sender is configured **could not be verified from this environment** — Supabase Function secrets are write-only via the API/CLI; there is no way to read back whether `RESEND_FROM_EMAIL`/`RESEND_API_KEY` are actually set without either a Supabase Dashboard check or a live, authorized test send.
- **Edge Function status:** both functions are `ACTIVE` and now running current, correctly-branded source (see §4).
- **API invocation status:** both functions correctly call `https://api.resend.com/emails` with proper Bearer auth, HTML-escaped template content, and now log a diagnostic line server-side on any non-2xx Resend response (new this phase).
- **Delivery status:** **not verifiable from this environment.** Edge Function logs for the last 24h show **zero invocations** of either `send-beta-invitation` or `send-workspace-invitation` — meaning no invitation email (successful or failed) was sent in that window, so there's no live delivery evidence either way. Actually testing delivery requires a real invite to an authorized recipient mailbox, which this phase did not have explicit authorization or a designated test address to do. **See §14.**
- **Remaining provider-side requirement:** confirm in the Resend dashboard that `RESEND_API_KEY` is set as a Supabase Function secret and that the sending domain behind `RESEND_FROM_EMAIL` (if set to a real `@` address rather than the sandbox default) is verified — Resend rejects sends from unverified domains.

## 6. Authentication

- **Login:** working (§2) — no defect found, real successful logins confirmed live.
- **Signup:** beta gate correctly enforced server-side and client-side (§3); no bypass found.
- **Session restoration:** unchanged since Phase 5's audit — `getSession()` + `onAuthStateChange`, `loading` flag gates `ProtectedRoute`. Still correct.
- **Refresh:** live logs show clean `token_revoked`/refresh cycles (`grant_type: refresh_token`, `status: 200`) for the same real user across multiple sessions over several days — session persistence across refresh is demonstrably working in production, not just in theory.
- **Logout:** Phase 5's `queryClient.clear()` fix (§9 of that phase's doc) is untouched by this phase — verified still present in `AuthContext.tsx`.
- **Re-login:** unaffected; no change made to sign-in/sign-out logic this phase.
- **Protected routes:** unaffected; `ProtectedRoute`/`RequireAdmin` unchanged.

## 7. PWA Authentication

No PWA-specific authentication code exists (confirmed in Phase 4/5's audits — session persistence is origin-scoped `localStorage`, identical in standalone and browser-tab mode) and this phase made no change to it. If an invitation-email link opens the system browser rather than the installed PWA when tapped from a phone's mail app, that is expected, standard web-link behavior — no manifest `capture_links`/App Link/Universal Link infrastructure exists or was requested, and none was added, per this phase's explicit "do not introduce native app-link infrastructure unless genuinely required" instruction. Not a defect.

## 8. Security

- **RLS:** unaffected — no schema/policy change made.
- **Auth boundaries:** unaffected — no change to `ProtectedRoute`, `RequireAdmin`, or any RPC's authorization logic.
- **Beta gate:** verified live (§3), not weakened.
- **Secret handling:** no secret was ever printed, logged, or committed. `RESEND_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY` continue to be read only via `Deno.env` inside the Edge Functions and never appear in a response body — confirmed by re-reading the deployed source after redeploy.
- **Invitation security:** unaffected — the trust-boundary logic (JWT auth → role/admin RPC re-check → service-role read → status re-verification) in both Edge Functions was not altered, only the branding strings and one logging line.
- **Cache isolation:** Phase 5's `queryClient.clear()` on logout remains intact (§6).
- **Advisors reviewed live:** `get_advisors(security)` returned only pre-existing, already-accepted findings (SECURITY DEFINER functions callable by `anon`/`authenticated` — each has its own internal auth check, consistent with Sprint 10's security review; `auth_leaked_password_protection` disabled — a Dashboard toggle, unrelated to this phase's scope, not touched). No new security finding.
- **Secret scan:** `git diff` for this phase's two changed files checked for key/token/credential patterns — clean.

## 9. Testing

No `src/` code changes were made this phase (the two genuine defects were a stale deployment and an external SMTP misconfiguration, neither of which is fixed by frontend/backend TypeScript changes), so the existing test suite is the correct measure — it is unchanged and still fully green:

```text
Test Files  239 passed (239)
Tests       1873 passed (1873)
```

The two modified files (`supabase/functions/send-beta-invitation/index.ts`, `supabase/functions/send-workspace-invitation/index.ts`) are Deno runtime code with no local test harness in this repo (confirmed by prior sprints — no Postgres/Deno test environment exists here); their correctness was instead verified by direct comparison against the live, redeployed source (§4) rather than a unit test, which is the accurate verification method for this kind of change.

## 10. Verification Gate

```text
tsc -b       ✅
vitest run   ✅  239/239 files, 1873/1873 tests
oxlint       ✅
vite build   ✅  (unchanged, no frontend code touched)
```

## 11. Redirect & Link Audit

`acceptUrl` construction in both Edge Functions uses `Deno.env.get('SITE_URL') ?? req.headers.get('origin') ?? ''` — no hardcoded domain, consistent with the "no unapproved domain" constraint carried through every prior phase. Frontend redirect construction (`AuthContext.tsx`'s `emailRedirectTo`/`redirectTo`) uses `window.location.origin`, unchanged and already verified correct in Phase 5. Live traffic (`referer: https://nolmark.co` in the Auth logs) confirms the app is already live at that origin — no code assumes any specific domain, so this works correctly regardless.

## 12. Update to Prior Assumption

Phase 3's forensic audit and prior sprint docs operated on the assumption that no public domain/live traffic existed yet ("no approved public domain exists," deliberately omitting `og:url`, etc.). Live Auth logs from this phase show the application **is already receiving real user traffic** at `https://nolmark.co`, including successful logins from a real account. This doesn't change any of Phase 3's actual decisions (which were correct given what was known at the time and remain safe/correct now — no domain was hardcoded anywhere), but it's worth recording explicitly: the "not yet launched" assumption in earlier docs is no longer accurate, which is part of why finding live-deployment drift (the NOVA-branded emails) in this phase was possible and valuable.

## 13. Remaining Issues

**Release blockers:**
- Supabase Auth SMTP credentials are invalid (`535` on `/recover` and `/magiclink`) — password reset and magic-link sign-in are completely broken for real users right now. External fix required; see §14.

**Important hardening (not blocking, but should be resolved soon):**
- `RESEND_API_KEY`/`RESEND_FROM_EMAIL` configuration status cannot be confirmed from this environment — needs either a Supabase Dashboard check or one authorized, controlled test send to confirm beta/workspace invitation emails actually reach a real inbox (not just get accepted by Resend's API).
- The workspace-invitation email template exists in two places (`src/modules/workspaces/email/buildInvitationEmail.ts` and inline in the Edge Function) with a documented "must be mirrored manually" comment and no automated drift check — this is how the NOVA/ARRIYIA drift happened in the first place. A future phase should consider either a build step that generates one from the other, or at minimum a CI reminder; not fixed here since it's an infrastructure change beyond this phase's narrow reliability scope.

**Cosmetic/polish:**
- None identified this phase.

**Future improvements:**
- Consider a lightweight "last deployed" marker or CI check that fails if `supabase/functions/*` source drifts from what's actually deployed — this exact class of defect (correct source, stale deployment) is what caused the NOVA-branded emails and could recur for any future Edge Function change.

## 14. External Actions Required

Listed explicitly, not buried in the narrative above:

1. **Supabase Dashboard → Authentication → Emails / SMTP Settings**: the configured SMTP credentials are returning `535 Authentication credentials invalid`. Password reset and magic-link email sending are completely broken until this is corrected with valid SMTP credentials (or Supabase's own default email sending is re-enabled, if that's the intended configuration).
2. **Resend Dashboard**: confirm `RESEND_API_KEY` is set as a Supabase Function secret for this project, and confirm the sending domain behind `RESEND_FROM_EMAIL` is verified (if a real branded sender is intended rather than Resend's sandbox `onboarding@resend.dev` default, which cannot send to arbitrary recipients in production).
3. **Manual verification**: a real, authorized test send (beta invitation and/or workspace invitation) to a real, designated test mailbox is the only way to confirm end-to-end delivery — this phase could not perform that without an authorized test address, and did not invent one or send a real invitation without explicit authorization.
