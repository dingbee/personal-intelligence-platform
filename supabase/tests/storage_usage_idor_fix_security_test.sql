-- P1-2 (ARRIYIA Production Stabilization Roadmap) — IDOR fix for
-- calculate_user_storage_usage(p_user_id uuid) — security test.
--
-- Same conventions as founding_pro_programme_security_test.sql: blocks
-- that need a specific caller identity set only the `request.jwt.claims`
-- GUC (not the Postgres role) to a real user id — auth.uid() reads
-- solely from this GUC regardless of role, so this resolves exactly as
-- it would for a real authenticated session while the connection keeps
-- its own read access to auth.users for the test's own setup queries.
-- Set via `set_config('request.jwt.claims', ..., true)` rather than a
-- literal `set local` because the target id is selected dynamically
-- per-block, not hardcoded — the `true` (is_local) argument gives the
-- same transaction-scoped confinement `set local` would; the closing
-- `rollback;` clears it either way. No rows are ever inserted, updated,
-- or deleted anywhere in this file — every assertion reads existing
-- production data, so this is 100% read-only and safe to run against
-- production at any time (same posture as storage_downgrade_safety_test.sql).
--
-- Admin identity confirmed live via is_platform_admin() by a prior test
-- in this same suite (founding_pro_programme_security_test.sql):
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co) — platform admin
--
-- Two non-admin callers are selected dynamically (rather than hardcoded)
-- via is_platform_admin(id), so this file makes no assumption about
-- which specific accounts are or aren't admins beyond the one already
-- independently confirmed above.
--
-- Run via `psql $DATABASE_URL -f supabase/tests/storage_usage_idor_fix_security_test.sql`
-- or the Supabase SQL editor.

-- ---------------------------------------------------------------------
-- 1. Self-access: an authenticated user can query their own storage
--    usage, and the RPC's result matches the same aggregate computed
--    directly against documents/assets — proving the fix's authorization
--    check did not change the underlying calculation.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_self uuid;
  v_expected bigint;
  v_actual bigint;
begin
  select id into v_self from auth.users where not public.is_platform_admin(id) order by created_at limit 1;

  if v_self is null then
    raise exception 'STORAGE IDOR TEST SKIPPED (1): no non-admin user available to test against';
  end if;

  select
    coalesce((select sum(file_size) from public.documents where user_id = v_self), 0) +
    coalesce((select sum(size_bytes) from public.assets where owner_id = v_self), 0)
  into v_expected;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_self, 'role', 'authenticated')::text, true);

  select public.calculate_user_storage_usage(v_self) into v_actual;

  if v_actual is distinct from v_expected then
    raise exception 'STORAGE IDOR TEST FAILED (1): self-query returned % but expected % (calculation must be unchanged by the fix)', v_actual, v_expected;
  end if;

  raise notice 'STORAGE IDOR TEST (1) PASSED: self-access returns %, matching the independently computed aggregate', v_actual;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 2. Cross-user, non-admin: a non-admin authenticated user CANNOT read
--    another user's storage usage — the core IDOR regression check.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_caller uuid;
  v_target uuid;
  v_raised boolean := false;
begin
  select id into v_caller from auth.users where not public.is_platform_admin(id) order by created_at limit 1 offset 0;
  select id into v_target from auth.users where not public.is_platform_admin(id) and id <> v_caller order by created_at limit 1 offset 0;

  if v_caller is null or v_target is null then
    raise exception 'STORAGE IDOR TEST SKIPPED (2): fewer than two non-admin users available to test against';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_caller, 'role', 'authenticated')::text, true);

  begin
    perform public.calculate_user_storage_usage(v_target);
  exception when others then
    if sqlerrm = 'Not authorized' then
      v_raised := true;
    else
      raise exception 'STORAGE IDOR TEST FAILED (2): expected "Not authorized" but got a different error: %', sqlerrm;
    end if;
  end;

  if not v_raised then
    raise exception 'STORAGE IDOR TEST FAILED (2): a non-admin user was able to read another user''s storage usage — IDOR is NOT fixed';
  end if;

  raise notice 'STORAGE IDOR TEST (2) PASSED: cross-user access by a non-admin correctly raises "Not authorized"';
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 3. Cross-user, platform admin: a confirmed platform admin CAN read
--    another user's storage usage, and the result matches the same
--    aggregate computed directly — proving the admin bypass and the
--    calculation both remain intact after the fix.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_admin uuid := '23c725ec-b2d6-487c-8291-dae7a280a291';
  v_target uuid;
  v_expected bigint;
  v_actual bigint;
begin
  if not public.is_platform_admin(v_admin) then
    raise exception 'STORAGE IDOR TEST SKIPPED (3): % is no longer a confirmed platform admin — update this test''s admin id', v_admin;
  end if;

  select id into v_target from auth.users where not public.is_platform_admin(id) and id <> v_admin order by created_at limit 1;

  if v_target is null then
    raise exception 'STORAGE IDOR TEST SKIPPED (3): no non-admin target user available to test against';
  end if;

  select
    coalesce((select sum(file_size) from public.documents where user_id = v_target), 0) +
    coalesce((select sum(size_bytes) from public.assets where owner_id = v_target), 0)
  into v_expected;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  select public.calculate_user_storage_usage(v_target) into v_actual;

  if v_actual is distinct from v_expected then
    raise exception 'STORAGE IDOR TEST FAILED (3): admin cross-user query returned % but expected % (calculation must be unchanged)', v_actual, v_expected;
  end if;

  raise notice 'STORAGE IDOR TEST (3) PASSED: platform admin cross-user access returns %, matching the independently computed aggregate', v_actual;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 4. Grant posture is unchanged by this migration: EXECUTE is still
--    granted to authenticated only, still revoked from public and anon
--    — re-confirms the fix did not accidentally widen or narrow the
--    function's own reachability, only its internal authorization logic.
-- ---------------------------------------------------------------------

do $$
declare
  v_authenticated_grant boolean;
  v_public_grant boolean;
  v_anon_grant boolean;
begin
  select exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'calculate_user_storage_usage'
      and grantee = 'authenticated' and privilege_type = 'EXECUTE'
  ) into v_authenticated_grant;

  select exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'calculate_user_storage_usage'
      and grantee = 'public' and privilege_type = 'EXECUTE'
  ) into v_public_grant;

  select exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = 'calculate_user_storage_usage'
      and grantee = 'anon' and privilege_type = 'EXECUTE'
  ) into v_anon_grant;

  if not v_authenticated_grant then
    raise exception 'STORAGE IDOR TEST FAILED (4): authenticated must still have EXECUTE on calculate_user_storage_usage';
  end if;

  if v_public_grant then
    raise exception 'STORAGE IDOR TEST FAILED (4): public must not have EXECUTE on calculate_user_storage_usage';
  end if;

  if v_anon_grant then
    raise exception 'STORAGE IDOR TEST FAILED (4): anon must not have EXECUTE on calculate_user_storage_usage';
  end if;

  raise notice 'STORAGE IDOR TEST (4) PASSED: grant posture unchanged — authenticated only, public/anon still revoked';
end $$;
