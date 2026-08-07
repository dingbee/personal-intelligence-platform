# Beta Invite + Quota System — Reconciliation & Repair

Audit and repair record for the manually-built Beta Invite → Signup → Plan → Quota system. Full technical detail (including the exact reasoning behind each fix) lives in `supabase/migrations/0034_beta_invite_quota_repair.sql`'s own header comments — this doc is the narrative summary.

## Starting state

`beta_invites`, `plans`, `plan_quotas`, `user_plan_assignments`, `quota_usage`, and the functions `is_beta_invited()`/`assign_default_plan()` were all created directly in the Supabase dashboard — none of it is represented in any migration file or in the remote migration ledger (`list_migrations` returns 25 entries, none of them touching any of these objects). `database.ts` (this repo's hand-maintained subset of the Supabase schema, not machine-generated — see its own header) had never been extended to include them either, which is what produced the `tsc`/test failures reported alongside this task.

## Confirmed defects and fixes

1. **`beta_invites.status`'s column default was corrupt.** It decoded to the 9-character string `'invited'` — literal embedded quote characters — instead of the clean 7-character `invited` that `is_beta_invited()`/`assign_default_plan()` compare against. A row relying on the default (rather than an explicit value) would silently fail the beta gate. Fixed the default; added a `CHECK (status in ('invited','accepted'))` to prevent recurrence.
2. **No case-insensitive uniqueness on `email`.** Only a case-sensitive `UNIQUE` existed. Added `UNIQUE (lower(email))`.
3. **The beta gate was entirely client-side.** `AuthContext.signUpWithPassword` checked `is_beta_invited()` before calling `auth.signUp()`, but nothing stopped `auth.signUp()` (or `signInWithOtp`, which can auto-create a user) from being called directly, bypassing the app's JS. Added a `BEFORE INSERT ON auth.users` trigger (`enforce_beta_invite_gate`) that rejects the insert server-side — the only enforcement point that covers every account-creation path uniformly.
4. **`plans`/`plan_quotas`/`user_plan_assignments`/`quota_usage` had RLS disabled entirely**, with full CRUD grants to `anon`+`authenticated` (flagged critical by Supabase's own advisor). Any client could rewrite its own plan assignment or quota usage, or — since `plan_quotas` isn't user-scoped — the global quota limits for every user. Enabled RLS on all four; added `SELECT`-only policies (own-row for the two user-scoped tables, public-read for the plan catalog); no write policies — all writes now go through `SECURITY DEFINER` functions.
5. **`quotaService.ts`'s reads/writes never filtered by billing period**, despite `quota_usage` being period-aware (`UNIQUE(user_id, quota_key, period_start)` already existed). The write path was also a non-atomic select-then-update/insert (lost-update race under concurrency). Added a `consume_quota(quota_key)` RPC (`SECURITY DEFINER`, atomic `INSERT … ON CONFLICT … DO UPDATE`, resolves the caller via `auth.uid()` not a client-supplied id) and added a `period_start` filter to the read path.

## Explicitly not changed

- **Invite acceptance timing** (marked `accepted` the moment the `auth.users` row is inserted, before email confirmation) — this exactly mirrors the codebase's own pre-existing `handle_new_user()`/`workspace_invitations` convention, so it's treated as intentional, not a defect.
- **`beta_invites`'s composite primary key** `(id, email, status)` — unusual, but harmless: the separate `UNIQUE(email)` already provides the real invariant, and correcting it would be a heavier, unrelated-risk change for no functional gain.
- **`invited_by` being `text` rather than a foreign key** — not causing an active defect, out of the requested scope.
- Every other pre-existing Supabase advisor finding (`function_search_path_mutable` on several long-standing functions, the `vector` extension living in `public`, leaked-password-protection being off) — pre-existing, unrelated to this system, not touched.

## Code changes

- `src/shared/types/database.ts` — added `BetaInvite`/`Plan`/`PlanQuota`/`UserPlanAssignment`/`QuotaUsage` types and their `Database.Tables`/`Functions` entries, by hand, matching this file's existing convention (**not** machine-generated — an earlier attempt at this task wholesale-replaced the file with real `supabase gen types` output, which broke ~60 unrelated files that import named type aliases this file hand-maintains; reverted and redone surgically).
- `src/shared/lib/quotaService.ts` — `checkQuota` now filters by current `period_start` and uses `.maybeSingle()`; `consumeQuota` now calls the `consume_quota` RPC instead of writing directly (RLS no longer permits direct writes).
- `src/modules/auth/AuthContext.tsx` — removed a leftover debug `console.log` from the beta-check path; no logic change (the RPC's own type is what needed fixing, not the call site).
- `src/modules/ai/orchestration/AIService.test.ts` — added the missing `vi.mock('@/shared/lib/quotaService', ...)`; this suite's 16 failures were caused by that omission (every other `AIService` dependency in the file is mocked) making real network calls to the live Supabase project during unit tests, not a logic defect.
- New tests: `src/shared/lib/quotaService.test.ts` (9 cases — no active plan, quota not configured, allowed/denied at/under/over limit, missing-usage-row defaults to 0, RPC success/error), `src/modules/auth/AuthContext.test.ts` (3 cases — invited proceeds to `auth.signUp`, non-invited blocked before ever calling it, RPC error surfaced without calling it).

## Not verifiable from this environment

Invite *consumption* (`assign_default_plan()`'s DB trigger logic — plan assignment, quota seeding, marking the invite accepted) and the new `enforce_beta_invite_gate` trigger's actual behavior can only be exercised against the live Postgres instance; there's no local Supabase/Postgres test harness in this repo. See the manual verification checklist delivered alongside this doc.
