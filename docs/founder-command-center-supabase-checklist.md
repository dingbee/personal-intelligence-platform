# Founder Command Center & AI Governance — Manual Supabase Verification Checklist

Everything below was applied live to project `uzshazetfkjkrdnxwjtl` and re-verified by direct query before writing this checklist — this is a list to *read*, not a script to run. Where an item says "No," that's confirming something is already correct, not asking you to do more work.

## 1. `user_plan_assignments` — the flawed constraint

**What you should see**: Database → Tables → `user_plan_assignments` → no `user_plan_assignments_user_id_active_key` constraint anymore. In its place, an index named `user_plan_assignments_one_active_idx`, a **partial unique index** on `(user_id) WHERE active`.

**Why it matters**: the old constraint was a literal `UNIQUE(user_id, active)`, which silently capped every user at *one* active assignment and *one* inactive assignment, ever. The very first plan change for any user worked; a second one would have failed with a constraint violation the moment `admin_change_user_plan` tried to deactivate the row from the first change. This was found live before it could bite anyone — only 1 assignment row existed platform-wide at the time (the founder's own), so nothing was at risk. The fix mirrors `workspace_members_one_active_owner_idx` (`0028_workspace_members.sql`), the one other place this codebase already expresses "at most one active X per user" correctly.

**Whether to change anything**: No.

## 2. New table: `platform_provider_settings`

**What you should see**: Table Editor → `platform_provider_settings`. Columns: `provider_id` (text, primary key), `enabled` (boolean, default true), `priority` (int, default 0), `updated_by`, `updated_at`. Empty until a founder actually changes a provider's status/priority from `/admin/ai` — an empty table is the correct starting state (every provider defaults to enabled, priority 0, until someone changes it).

RLS: **enabled**, one policy, `"Authenticated users can view platform provider settings"`, `SELECT` only, `USING (true)`. No `INSERT`/`UPDATE`/`DELETE` policy for any client role — every signed-in user's client reads this table directly (that's how `resolveProviderChain` factors it into routing without an extra RPC round trip), but only `admin_set_platform_provider_setting` can write it.

**Why it matters**: this is what makes "AI Governance Console" real platform control rather than decoration — before this table existed, the "AI Providers" toggle on the old dashboard silently wrote to the founder's own `provider_overrides` row, which only affected the founder's personal chat, not the platform.

**Whether to change anything**: No.

## 3. New RPCs: `admin_change_user_plan`, `admin_reset_user_quota`, `admin_set_platform_provider_setting`, `admin_ai_usage_summary`, `admin_platform_counts`, `admin_update_plan_quota`

**What you should see**: all six exist under Database → Functions, all `SECURITY DEFINER`, all opening with the same `if not public.is_platform_admin() then raise exception 'Not authorized'; end if;` guard every prior admin function uses. Grantees: `authenticated` only for each — verify with:
```sql
select has_function_privilege('anon', 'public.admin_change_user_plan(uuid,uuid)', 'execute');
```
should return `false` for every one of the six (substituting each function's own name/signature).

**Why it matters**: these are the actual write paths behind Users (plan change, quota reset, disable), Plans (quota limit edit), and AI Governance (provider enable/priority) — before this migration, none of these mutations had any sanctioned path at all; a founder literally could not change a user's plan or reset their quota through the app.

**Whether to change anything**: No.

## 4. `admin_set_user_disabled` — real auth-level disable, not a cosmetic flag

**What you should see**: the function updates `auth.users.banned_until` directly — set to `infinity` when disabling, `null` when re-enabling. This is Supabase Auth's own field, checked by GoTrue on sign-in and token refresh, so a disabled account is actually locked out, not just hidden from the UI. The function also refuses to let a caller disable `auth.uid()` itself (`p_user_id = auth.uid()` raises `'Cannot disable your own account'`) — since granting admin status has no client-reachable path either, a founder locking out their own account would have no recovery route, so this is blocked outright.

You can confirm the mechanism directly:
```sql
select id, banned_until from auth.users where email = 'someone@example.com';
```
After disabling via `/admin/users`, `banned_until` should read a far-future timestamp; after re-enabling, `null`.

**Whether to change anything**: No.

## 5. `admin_list_users` now returns `is_disabled`

**What you should see**: the function was dropped and recreated (changing a `RETURNS TABLE` shape requires that — `CREATE OR REPLACE` can't add a column) with one added boolean, `is_disabled`, computed from `auth.users.banned_until is not null and banned_until > now()`. Same grants as before (`authenticated` only, `anon` explicitly revoked — see §6).

**Why it matters**: this is what lets the Users page show current status and choose the right action label ("Disable account" vs. "Re-enable account") without a second query per row.

**Whether to change anything**: No.

## 6. Defense-in-depth finding: `anon` had `EXECUTE` on every admin function, project-wide

**What you should see**: this project has `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated` configured at the project level — visible via:
```sql
select defaclacl from pg_default_acl da
join pg_namespace n on n.oid = da.defaclnamespace
where n.nspname = 'public' and da.defaclobjtype = 'f';
```
This means **every function ever created in this project** (not just this phase's) was automatically granted `EXECUTE` directly to `anon` on creation — separate from, and not removed by, the `revoke execute ... from public` statement every admin migration in this project (including the prior phase's) has used. `has_function_privilege('anon', 'public.is_platform_admin(uuid)', 'execute')` returned `true` before this was caught.

**Why it matters, and why it was never an actual bypass**: every admin function's own internal `is_platform_admin()` check still rejected an unauthenticated caller correctly — `auth.uid()` is `null` for `anon`, so the check's `exists(...)` is always false, and the function raises `'Not authorized'` regardless of the outer grant. This was confirmed directly: calling `admin_platform_counts()` with no auth context returns `P0001: Not authorized`, not data. So this was a hardening gap (an unauthenticated caller could learn an endpoint exists and gets rejected), not a way to actually read or write anything. This migration adds explicit `revoke execute ... from anon` for every function it creates, plus a scoped tightening pass for `is_platform_admin`/`admin_list_users`/`admin_list_beta_invites`/`admin_create_beta_invite`/`admin_revoke_beta_invite` (the prior phase's admin functions) — deliberately not touching `is_beta_invited` (meant to stay anon-callable for pre-signup checks) or trigger-only functions nothing calls via RPC.

**Whether to change anything**: No — already fixed as part of this migration. Worth knowing this project-level default exists, though: any *future* admin-style function will need the same explicit `revoke ... from anon` (not just `from public`) to actually restrict execution, since the schema default re-grants it on every `CREATE FUNCTION`.

## 7. What "healthy" looks like end-to-end

Signed in as `dan@nolmark.co`: `/admin/users` shows every account with working Change plan / Reset quota / Disable actions; `/admin/plans` shows the four plans with editable quota limits; `/admin/ai` shows each configured provider with a platform-wide Enable/Disable toggle and priority field, and disabling one there (not in Settings/Advanced Settings) should make that provider stop appearing in *any* user's chat routing, not just the founder's own. Signed in as any other account, none of `/admin`, `/admin/users`, `/admin/plans`, `/admin/ai` are reachable (redirect to `/`), and calling any `admin_*` RPC from that account's browser console returns `Not authorized`. If either doesn't hold, re-check in the order above — starting with the constraint fix, since a plan-change failure would surface there first.
