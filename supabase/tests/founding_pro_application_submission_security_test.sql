-- Founding Pro Programme Phase 2 — submit_founding_pro_application()
-- security/behavior test. Same conventions as
-- founding_pro_programme_security_test.sql: each numbered block is a
-- self-contained `begin; ... rollback;` transaction (mutating blocks
-- only), `request.jwt.claims` is set to simulate a real authenticated
-- session (no role switch — see that file's header for why keeping the
-- elevated connection role while only setting the JWT-claims GUC is both
-- sufficient for auth.uid()/is_platform_admin() and necessary so this
-- script's own setup queries can still read auth.users).
--
-- Users used purely as valid auth.users(id) FK targets, never persisted:
--   5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1 (engutoto@gmail.com)
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com)
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com)
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co)

-- ---------------------------------------------------------------------
-- 1. A fresh authenticated user with no prior application/membership can
--    submit; the row is created with status='pending', and an
--    application_submitted audit event is recorded.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1","role":"authenticated"}';

do $$
declare
  v_result jsonb;
  v_application_id uuid;
begin
  v_result := public.submit_founding_pro_application();

  if v_result->>'status' <> 'pending' then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (1): expected status pending, got %', v_result->>'status';
  end if;

  v_application_id := (v_result->>'application_id')::uuid;

  if not exists (
    select 1 from public.founding_pro_applications
    where id = v_application_id and user_id = '5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1' and status = 'pending'
  ) then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (1): application row not created as expected';
  end if;

  if not exists (
    select 1 from public.founding_pro_events
    where application_id = v_application_id and event_type = 'application_submitted'
      and actor_user_id = '5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1'
  ) then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (1): no application_submitted audit event was recorded';
  end if;

  raise notice 'FOUNDING PRO SUBMIT TEST (1) PASSED: fresh submission creates a pending application and an audit event';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. A second submission while one is already pending is rejected (the
--    one-active-application-per-user constraint), and no second row is
--    created.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1","role":"authenticated"}';

do $$
declare
  v_first jsonb;
  v_failed boolean := false;
  v_count int;
begin
  v_first := public.submit_founding_pro_application();

  begin
    perform public.submit_founding_pro_application();
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (2): a second submission while pending was accepted';
  end if;

  select count(*) into v_count from public.founding_pro_applications where user_id = '5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1';
  if v_count <> 1 then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (2): expected exactly 1 application row, found %', v_count;
  end if;

  raise notice 'FOUNDING PRO SUBMIT TEST (2) PASSED: duplicate submission while pending is rejected, no second row created';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. A user who already has a founding_pro_members row cannot submit a
--    new application, even if they have no application row at all.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';

do $$
declare
  v_failed boolean := false;
begin
  insert into public.founding_pro_members (user_id, slot_type, founding_member_number, founding_price_cents, currency, founding_expires_at)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'public', 77, 1999, 'USD', now() + interval '3 months');

  begin
    perform public.submit_founding_pro_application();
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (3): an existing Founding Pro member was able to submit a new application';
  end if;

  if exists (select 1 from public.founding_pro_applications where user_id = '249c4f9a-fe94-4174-af49-ca38d526caba') then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (3): an application row was created despite the member already being enrolled';
  end if;

  raise notice 'FOUNDING PRO SUBMIT TEST (3) PASSED: an existing Founding Pro member cannot submit a new application';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. Anonymous (no JWT claims set at all) submission is rejected with a
--    clear authentication error, and creates no row.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_failed boolean := false;
begin
  begin
    perform public.submit_founding_pro_application();
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (4): submission with no authenticated session succeeded';
  end if;

  raise notice 'FOUNDING PRO SUBMIT TEST (4) PASSED: submission with no authenticated session is rejected';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. Structural check (read-only): anon cannot execute the function at
--    all, at the grant level — belt-and-suspenders alongside test 4's
--    live auth.uid() check.
-- ---------------------------------------------------------------------

do $$
begin
  if has_function_privilege('anon', 'public.submit_founding_pro_application()', 'EXECUTE') then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (5): anon can execute submit_founding_pro_application';
  end if;

  raise notice 'FOUNDING PRO SUBMIT TEST (5) PASSED: anon is grant-blocked from submit_founding_pro_application';
end;
$$;

-- ---------------------------------------------------------------------
-- 6. A rejected (or withdrawn) prior application does not block
--    reapplying — only 'pending'/'approved' rows are "active" per the
--    partial unique index and this function's own pre-check.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"9e733cfc-e6ae-45e6-8b14-dc64247a9cb2","role":"authenticated"}';

do $$
declare
  v_result jsonb;
begin
  insert into public.founding_pro_applications (user_id, status, reviewed_at)
  values ('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'rejected', now());

  v_result := public.submit_founding_pro_application();

  if v_result->>'status' <> 'pending' then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (6): reapplication after rejection did not succeed';
  end if;

  if (select count(*) from public.founding_pro_applications where user_id = '9e733cfc-e6ae-45e6-8b14-dc64247a9cb2') <> 2 then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (6): expected 2 application rows (rejected + new pending)';
  end if;

  raise notice 'FOUNDING PRO SUBMIT TEST (6) PASSED: a rejected prior application does not block reapplying';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 7. Client cannot set status/reviewed_by/reviewed_at/anything else via
--    this RPC — it takes zero arguments, so there is no parameter through
--    which a caller could ever request 'approved' or 'enrolled' directly.
--    Structural check on the function signature.
-- ---------------------------------------------------------------------

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.submit_founding_pro_application()'::regprocedure);

  if v_def like '%p_status%' or v_def like '%p_approved%' then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (7): function unexpectedly accepts a status-like parameter';
  end if;

  if v_def not like '%''pending''%' then
    raise exception 'FOUNDING PRO SUBMIT TEST FAILED (7): function no longer hardcodes status to pending';
  end if;

  raise notice 'FOUNDING PRO SUBMIT TEST (7) PASSED: submit_founding_pro_application takes no arguments and hardcodes status=pending';
end;
$$;
