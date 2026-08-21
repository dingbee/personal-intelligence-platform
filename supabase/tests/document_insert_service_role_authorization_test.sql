-- Google Drive import "document insert failed: Not authorized" (P0001) fix
-- — security/regression test for 0084_resolve_effective_quota_limit_
-- service_role.sql.
--
-- Root cause: enforce_storage_quota() (0046, BEFORE INSERT trigger on
-- documents/assets) calls resolve_effective_quota_limit() (0041) and
-- calculate_user_storage_usage() (0046/0070), both of which required
-- `auth.uid() = p_user_id OR is_platform_admin()` — correct for a
-- client-facing RPC call, but wrong as an internal guard inside a trigger
-- that must also run for service-role-driven inserts (google-drive-import),
-- where there is no end-user JWT at all and auth.uid() is NULL. 0084 fixes
-- both functions to also allow the auth.uid() IS NULL case (service_role/
-- postgres only — never anon, never authenticated with a spoofed identity).
--
-- Same conventions as storage_usage_idor_fix_security_test.sql: callers are
-- impersonated via the `request.jwt.claims` GUC (auth.uid() reads solely
-- from this, regardless of Postgres role), each mutating assertion is
-- wrapped in its own begin/rollback so nothing is left behind, and a
-- service-role-context call is simulated by clearing request.jwt.claims
-- entirely (auth.uid() then resolves to NULL, exactly as it does for a
-- real service-role Postgres session — see auth.uid()'s own definition).
--
-- Admin identity reused from storage_usage_idor_fix_security_test.sql:
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co) — platform admin
--
-- Run via `psql $DATABASE_URL -f supabase/tests/document_insert_service_role_authorization_test.sql`
-- or the Supabase SQL editor.

-- ---------------------------------------------------------------------
-- 1. THE FIX: a service-role-context call (no JWT at all) can resolve
--    quota limit and storage usage for an arbitrary real user — this is
--    exactly what enforce_storage_quota()'s trigger needs to do on every
--    documents/assets insert, and exactly what was failing before 0084.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_user uuid;
  v_limit bigint;
  v_usage bigint;
begin
  select id into v_user from auth.users limit 1;
  if v_user is null then
    raise exception 'DOC INSERT AUTH TEST SKIPPED (1): no user available to test against';
  end if;

  perform set_config('request.jwt.claims', '', true);

  if auth.uid() is not null then
    raise exception 'DOC INSERT AUTH TEST SETUP FAILED (1): auth.uid() should be NULL with no JWT claims, got %', auth.uid();
  end if;

  select public.resolve_effective_quota_limit(v_user, 'storage_bytes') into v_limit;
  select public.calculate_user_storage_usage(v_user) into v_usage;

  raise notice 'DOC INSERT AUTH TEST (1) PASSED: service-role-context calls succeeded (limit=%, usage=%)', v_limit, v_usage;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 2. THE END-TO-END FIX: a service-role-context INSERT into documents
--    (exactly what google-drive-import does) now succeeds, with the
--    inserted row owned by the target user — this is the actual
--    production failure being fixed, reproduced and proven fixed at the
--    database layer. No row is left behind (transaction rolled back).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_user uuid;
  v_doc_id uuid;
  v_owner uuid;
begin
  select id into v_user from auth.users limit 1;
  if v_user is null then
    raise exception 'DOC INSERT AUTH TEST SKIPPED (2): no user available to test against';
  end if;

  perform set_config('request.jwt.claims', '', true);

  insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, source, source_file_id, source_metadata, imported_at)
  values (v_user, 'Test Drive import', 'test.pdf', 'test/' || gen_random_uuid()::text || '-test.pdf', 'pdf', 1024, 'google_drive', 'test-file-id-' || gen_random_uuid()::text, '{"mimeType":"application/pdf"}'::jsonb, now())
  returning id, user_id into v_doc_id, v_owner;

  if v_owner is distinct from v_user then
    raise exception 'DOC INSERT AUTH TEST FAILED (2): inserted document owner % does not match the intended user %', v_owner, v_user;
  end if;

  raise notice 'DOC INSERT AUTH TEST (2) PASSED: service-role documents insert succeeded, owned by % (doc id %)', v_owner, v_doc_id;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 3. REGRESSION — self-access unchanged: an authenticated user can still
--    resolve their own quota/usage, with the same values as before.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_self uuid;
  v_limit_service bigint;
  v_limit_self bigint;
  v_usage_service bigint;
  v_usage_self bigint;
begin
  select id into v_self from auth.users where not public.is_platform_admin(id) order by created_at limit 1;
  if v_self is null then
    raise exception 'DOC INSERT AUTH TEST SKIPPED (3): no non-admin user available to test against';
  end if;

  perform set_config('request.jwt.claims', '', true);
  select public.resolve_effective_quota_limit(v_self, 'storage_bytes') into v_limit_service;
  select public.calculate_user_storage_usage(v_self) into v_usage_service;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_self, 'role', 'authenticated')::text, true);
  select public.resolve_effective_quota_limit(v_self, 'storage_bytes') into v_limit_self;
  select public.calculate_user_storage_usage(v_self) into v_usage_self;

  if v_limit_service is distinct from v_limit_self or v_usage_service is distinct from v_usage_self then
    raise exception 'DOC INSERT AUTH TEST FAILED (3): service-role and self-authenticated results diverge (limits % vs %, usage % vs %)',
      v_limit_service, v_limit_self, v_usage_service, v_usage_self;
  end if;

  raise notice 'DOC INSERT AUTH TEST (3) PASSED: self-access via authenticated JWT unchanged (limit=%, usage=%)', v_limit_self, v_usage_self;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 4. REGRESSION — cross-user, non-admin: a non-admin authenticated user
--    still CANNOT resolve another user's quota/usage. Core IDOR guard
--    from 0041/0070 must remain intact.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_caller uuid;
  v_target uuid;
  v_raised_limit boolean := false;
  v_raised_usage boolean := false;
begin
  select id into v_caller from auth.users where not public.is_platform_admin(id) order by created_at limit 1;
  select id into v_target from auth.users where not public.is_platform_admin(id) and id <> v_caller order by created_at limit 1;

  if v_caller is null or v_target is null then
    raise exception 'DOC INSERT AUTH TEST SKIPPED (4): fewer than two non-admin users available to test against';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_caller, 'role', 'authenticated')::text, true);

  begin
    perform public.resolve_effective_quota_limit(v_target, 'storage_bytes');
  exception when others then
    if sqlerrm = 'Not authorized' then v_raised_limit := true;
    else raise exception 'DOC INSERT AUTH TEST FAILED (4a): expected "Not authorized" but got: %', sqlerrm;
    end if;
  end;

  begin
    perform public.calculate_user_storage_usage(v_target);
  exception when others then
    if sqlerrm = 'Not authorized' then v_raised_usage := true;
    else raise exception 'DOC INSERT AUTH TEST FAILED (4b): expected "Not authorized" but got: %', sqlerrm;
    end if;
  end;

  if not v_raised_limit or not v_raised_usage then
    raise exception 'DOC INSERT AUTH TEST FAILED (4): a non-admin user read another user''s quota/usage — IDOR guard is broken';
  end if;

  raise notice 'DOC INSERT AUTH TEST (4) PASSED: cross-user access by a non-admin still correctly denied for both functions';
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 5. REGRESSION — cross-user, platform admin: unchanged, still allowed.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_admin uuid := '23c725ec-b2d6-487c-8291-dae7a280a291';
  v_target uuid;
  v_limit bigint;
  v_usage bigint;
begin
  if not public.is_platform_admin(v_admin) then
    raise exception 'DOC INSERT AUTH TEST SKIPPED (5): % is no longer a confirmed platform admin — update this test''s admin id', v_admin;
  end if;

  select id into v_target from auth.users where not public.is_platform_admin(id) and id <> v_admin order by created_at limit 1;
  if v_target is null then
    raise exception 'DOC INSERT AUTH TEST SKIPPED (5): no non-admin target user available to test against';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  select public.resolve_effective_quota_limit(v_target, 'storage_bytes') into v_limit;
  select public.calculate_user_storage_usage(v_target) into v_usage;

  raise notice 'DOC INSERT AUTH TEST (5) PASSED: platform admin cross-user access still works (limit=%, usage=%)', v_limit, v_usage;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 6. THE ATTACK THIS FIX MUST NOT ENABLE — arbitrary user_id cannot be
--    supplied to create another user's document: a regular authenticated
--    user attempting to insert a documents row owned by someone else is
--    still blocked, exactly as before 0084. This is the proof that
--    relaxing the auth.uid() IS NULL case did not weaken normal
--    client-driven authorization at all.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_caller uuid;
  v_target uuid;
  v_raised boolean := false;
begin
  select id into v_caller from auth.users where not public.is_platform_admin(id) order by created_at limit 1;
  select id into v_target from auth.users where not public.is_platform_admin(id) and id <> v_caller order by created_at limit 1;

  if v_caller is null or v_target is null then
    raise exception 'DOC INSERT AUTH TEST SKIPPED (6): fewer than two non-admin users available to test against';
  end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_caller, 'role', 'authenticated')::text, true);

  begin
    insert into public.documents (user_id, title, file_name, file_path, file_type, file_size, source, source_file_id, source_metadata, imported_at)
    values (v_target, 'Spoofed owner attempt', 'x.pdf', 'x/' || gen_random_uuid()::text || '.pdf', 'pdf', 1024, 'google_drive', 'x', '{}'::jsonb, now());
  exception when others then
    v_raised := true;
  end;

  if not v_raised then
    raise exception 'DOC INSERT AUTH TEST FAILED (6): a regular authenticated user was able to insert a document owned by another user — ownership spoofing is possible';
  end if;

  raise notice 'DOC INSERT AUTH TEST (6) PASSED: a regular authenticated user cannot create a document owned by another user';
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 7. Grant posture unchanged for both functions: EXECUTE still granted
--    to authenticated only, still revoked from public and anon.
-- ---------------------------------------------------------------------

do $$
declare
  v_fn text;
  v_authenticated_grant boolean;
  v_public_grant boolean;
  v_anon_grant boolean;
begin
  foreach v_fn in array array['resolve_effective_quota_limit', 'calculate_user_storage_usage']
  loop
    select exists (
      select 1 from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = v_fn and grantee = 'authenticated' and privilege_type = 'EXECUTE'
    ) into v_authenticated_grant;

    select exists (
      select 1 from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = v_fn and grantee = 'public' and privilege_type = 'EXECUTE'
    ) into v_public_grant;

    select exists (
      select 1 from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = v_fn and grantee = 'anon' and privilege_type = 'EXECUTE'
    ) into v_anon_grant;

    if not v_authenticated_grant then
      raise exception 'DOC INSERT AUTH TEST FAILED (7): authenticated must still have EXECUTE on %', v_fn;
    end if;
    if v_public_grant then
      raise exception 'DOC INSERT AUTH TEST FAILED (7): public must not have EXECUTE on %', v_fn;
    end if;
    if v_anon_grant then
      raise exception 'DOC INSERT AUTH TEST FAILED (7): anon must not have EXECUTE on %', v_fn;
    end if;

    raise notice 'DOC INSERT AUTH TEST (7) PASSED for %: grant posture unchanged — authenticated only', v_fn;
  end loop;
end $$;
