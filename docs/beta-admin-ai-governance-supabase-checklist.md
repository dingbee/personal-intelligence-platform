# Beta / Admin / AI Governance Foundation — Manual Supabase Verification Checklist

Phase 9 of the "Pause UX Roadmap & Complete Beta / Admin / AI Governance Foundation" task. This is a checklist to *read and verify*, not a script to run. Every "what to check" item is a read-only lookup (Table Editor / SQL Editor `select`, or the Database → Functions / Policies screens) — nothing here asks you to execute a mutation. Where "whether to change anything" says "No," that's a real answer, not a placeholder: most of this is confirming Phase 4–7 landed exactly as intended, not asking you to do further work.

Everything below was already applied live via migration `0035_platform_admin_foundation.sql` and re-verified by direct query before writing this checklist. `0034_beta_invite_quota_repair.sql` (beta invites/plans/quota) was covered in the prior `docs/beta-invite-quota-reconciliation.md` checklist — re-listed here only briefly, since this phase didn't touch it further, so you have one place to check everything this phase's admin/AI-governance model depends on.

## 1. New table: `platform_admins`

**What you should see**: Table Editor → `platform_admins`. Exactly one row: `user_id = 23c725ec-b2d6-487c-8291-dae7a280a291` (your `dan@nolmark.co` account), `granted_by` the same id, `granted_at` a timestamp from when this migration ran.

**Why it matters**: this row is the entire bootstrap of the admin system — it's what makes `/admin` reachable at all right now. If it's missing or has the wrong `user_id`, the Admin Dashboard will redirect you to `/` as a non-admin.

**Whether to change anything**: No, unless you want to grant a second founder/admin account. To do that later, the only sanctioned path is another manual `insert into platform_admins (user_id, granted_by) values (...)` — there is deliberately no UI or RPC that can do this (see §2), so a future teammate becoming admin is always a conscious action you take directly in Supabase, never something the app can do to itself.

## 2. RLS policies on `platform_admins`

**What you should see**: Database → Tables → `platform_admins` → RLS: **enabled**. Exactly one policy, `"Users can check their own admin status"`, `SELECT` only, `USING (auth.uid() = user_id)`, role `authenticated`. No `INSERT`/`UPDATE`/`DELETE` policy at all, for any role.

**Why it matters**: this is the literal mechanism behind "founder privileges cannot be self-assigned." A signed-in user can only ever confirm *their own* admin status (that's what `usePlatformAdmin()` reads) — they cannot see the full admin roster, and there is no client-reachable way to insert themselves or anyone else into this table. Granting admin is only possible by someone with direct Supabase access running an explicit `insert`, exactly like the bootstrap row above.

**Whether to change anything**: No. Adding a write policy here — even one that seems convenient (e.g. "let existing admins add new admins from the UI") — would need its own deliberate design and explicit approval; it is out of scope for this phase and not something to do by editing policies directly.

## 3. Function: `is_platform_admin(uid uuid default auth.uid())`

**What you should see**: Database → Functions → `is_platform_admin`. `SECURITY DEFINER`, `STABLE`, `search_path = public`. Grantees: `authenticated` only — **not** `public`/`anon`. You can verify this directly:
```sql
select has_function_privilege('anon', 'public.is_platform_admin(uuid)', 'execute');
```
should return `false`.

**Why it matters**: this is the single source of truth both the client (`usePlatformAdmin()` hook, `RequireAdmin` route guard) and every admin RPC below check. It reads `platform_admins` under its own elevated privileges, bypassing that table's RLS — which is fine and intended, since it only ever returns a boolean, never row contents, and defaults to checking the *caller's own* `auth.uid()`.

**Whether to change anything**: No.

## 4. Admin RPCs: `admin_list_users`, `admin_list_beta_invites`, `admin_create_beta_invite`, `admin_revoke_beta_invite`

**What you should see**: all four exist under Database → Functions, all `SECURITY DEFINER`, all grantees `authenticated` only (not `public`/`anon` — same `has_function_privilege` check as above, substituting each function's name/signature). Each one's body opens with `if not public.is_platform_admin() then raise exception 'Not authorized'; end if;` — you can see this in the function source in the SQL Editor or in `supabase/migrations/0035_platform_admin_foundation.sql` in the repo.

**Why it matters**: this is what makes admin authorization *server-enforced*, not merely UI-hidden. `profiles` and `beta_invites` both have RLS locked to self-only for ordinary clients (by design, from the prior reconciliation pass) — these functions run with elevated privilege specifically to bridge that gap for a verified admin caller, the same pattern the existing `list_workspace_members()` function already uses elsewhere in this codebase. A non-admin calling any of these four gets a Postgres exception, not an empty or partial result — there's no way to "quietly" get back other users' data.

You can sanity-check the rejection path yourself as a non-admin (e.g. in a second test account, or by temporarily removing your own `platform_admins` row and putting it back): calling any of the four from the browser console (`supabase.rpc('admin_list_users')`) should return an error, not data.

**Whether to change anything**: No.

## 5. `beta_invites`, `plans`, `plan_quotas`, `user_plan_assignments`, `quota_usage` (carried over from the prior reconciliation pass)

**What you should see**: unchanged since `docs/beta-invite-quota-reconciliation.md`'s own checklist — `beta_invites` still has exactly 1 row (`dan@nolmark.co`, `status: accepted`), RLS still enabled on all five tables with no client write policies, `consume_quota()` still the only way quota is ever incremented. This phase re-verified all of it live and found no drift.

**Why it matters**: the new admin RPCs in §4 read from these tables (`admin_list_users` joins `user_plan_assignments`/`plans`/`plan_quotas`/`quota_usage`; `admin_list_beta_invites` reads `beta_invites` directly) — if anything here had drifted since the last check, the Admin Dashboard's numbers would be wrong. It hasn't.

**Whether to change anything**: No — if you want the full detail on why each of these is already correct, see the prior checklist; nothing new to verify here beyond confirming it still matches.

## 6. `provider_overrides` — confirm it's untouched

**What you should see**: still exactly as before — `RLS: auth.uid() = user_id` for all operations, no platform-wide/global override row or table.

**Why it matters**: the discovery doc (§10/§12) explicitly scoped a platform-wide "disable this provider for everyone" capability out of this phase — it would be new schema, not a fix to something broken. The Admin Dashboard's "AI Providers" section is read-only visibility (reusing the existing `ProviderStatusCard`), not a write surface, so nothing needed to change here.

**Whether to change anything**: No — this is a confirmation that nothing changed, not an action item. If you later want founders to be able to force-disable a provider platform-wide, that's new schema design and a new phase, not a checklist item here.

## 7. What "healthy" looks like end-to-end

If every item above matches: signing in as `dan@nolmark.co` and visiting `/admin` shows the six-section dashboard (Overview, Beta Invites, Users, Plans & Quotas, AI Providers, System Health) with real data, not placeholders. Signing in as any other account and visiting `/admin` (or `/settings/ai-health`) redirects to `/` — the sidebar's "Admin" link doesn't even render for a non-admin, since `Sidebar.tsx` also checks `usePlatformAdmin()`. If either of those doesn't hold, something in §1–§4 above has drifted from what's expected and is worth re-checking in that order (bootstrap row → RLS policy → `is_platform_admin` grants → the four RPCs' grants).
