-- Founding Pro Programme Phase 3 — admin operations security/lifecycle
-- test. Same conventions as the Phase 1/2 test files: each numbered
-- block is a self-contained `begin; ... rollback;` transaction (mutating
-- blocks only), `request.jwt.claims` simulates a real authenticated
-- session (no role switch — see founding_pro_programme_security_test.sql's
-- header for why). Real pre-existing users are used purely as valid
-- auth.users(id) FK targets and are never persisted.
--
-- Users used:
--   23c725ec-b2d6-487c-8291-dae7a280a291 (dan@nolmark.co) — real admin
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com)
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com)
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co)
--
-- Deliberately does NOT reuse 5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1
-- (engutoto@gmail.com) as an applicant anywhere in this file — that user
-- has a real, live pending Founding Pro application already, and this
-- file must never touch real application state, even inside a
-- rolled-back transaction (a mid-test failure could theoretically leave
-- a partial state visible to a concurrent reader before rollback).

-- ---------------------------------------------------------------------
-- 1. A non-admin authenticated user cannot approve a pending application.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_failed boolean := false;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'pending')
  returning id into v_app;

  begin
    perform public.admin_approve_founding_pro_application(v_app);
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (1): a non-admin was able to approve an application';
  end if;

  if exists (select 1 from public.founding_pro_applications where id = v_app and status <> 'pending') then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (1): application status changed despite non-admin rejection';
  end if;

  raise notice 'FOUNDING PRO ADMIN TEST (1) PASSED: a non-admin cannot approve an application';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. A non-admin authenticated user cannot reject a pending application.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_failed boolean := false;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'pending')
  returning id into v_app;

  begin
    perform public.admin_reject_founding_pro_application(v_app);
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (2): a non-admin was able to reject an application';
  end if;

  raise notice 'FOUNDING PRO ADMIN TEST (2) PASSED: a non-admin cannot reject an application';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. An admin can approve a pending application: status -> approved,
--    reviewer/timestamp recorded, correct audit event written, no
--    membership created, no public slot consumed.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_result public.founding_pro_applications;
  v_capacity_before int;
  v_capacity_after int;
  v_member_count_before int;
  v_member_count_after int;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'pending')
  returning id into v_app;

  select enrolled_public_count into v_capacity_before from public.founding_pro_capacity where id = 1;
  select count(*) into v_member_count_before from public.founding_pro_members;

  v_result := public.admin_approve_founding_pro_application(v_app);

  if v_result.status <> 'approved' then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (3): status is % instead of approved', v_result.status;
  end if;
  if v_result.reviewed_by <> '23c725ec-b2d6-487c-8291-dae7a280a291' then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (3): reviewed_by was not recorded as the acting admin';
  end if;
  if v_result.reviewed_at is null then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (3): reviewed_at was not recorded';
  end if;

  if not exists (
    select 1 from public.founding_pro_events
    where application_id = v_app and event_type = 'application_approved'
      and actor_user_id = '23c725ec-b2d6-487c-8291-dae7a280a291'
      and target_user_id = '249c4f9a-fe94-4174-af49-ca38d526caba'
  ) then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (3): no application_approved audit event was recorded';
  end if;

  select enrolled_public_count into v_capacity_after from public.founding_pro_capacity where id = 1;
  select count(*) into v_member_count_after from public.founding_pro_members;

  if v_capacity_after <> v_capacity_before then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (3): approval consumed a public slot (% -> %)', v_capacity_before, v_capacity_after;
  end if;
  if v_member_count_after <> v_member_count_before then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (3): approval created a membership row';
  end if;

  raise notice 'FOUNDING PRO ADMIN TEST (3) PASSED: admin approval updates lifecycle state, records reviewer/audit, consumes no slot, creates no membership';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. An admin can reject a pending application: status -> rejected,
--    reviewer/timestamp recorded, correct audit event written.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_result public.founding_pro_applications;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'pending')
  returning id into v_app;

  v_result := public.admin_reject_founding_pro_application(v_app);

  if v_result.status <> 'rejected' then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (4): status is % instead of rejected', v_result.status;
  end if;
  if v_result.reviewed_by <> '23c725ec-b2d6-487c-8291-dae7a280a291' or v_result.reviewed_at is null then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (4): reviewer/timestamp not recorded';
  end if;

  if not exists (
    select 1 from public.founding_pro_events
    where application_id = v_app and event_type = 'application_rejected'
      and actor_user_id = '23c725ec-b2d6-487c-8291-dae7a280a291'
      and target_user_id = '9e733cfc-e6ae-45e6-8b14-dc64247a9cb2'
  ) then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (4): no application_rejected audit event was recorded';
  end if;

  raise notice 'FOUNDING PRO ADMIN TEST (4) PASSED: admin rejection updates lifecycle state, records reviewer, writes audit event';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. An already-approved application cannot be approved again.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_failed boolean := false;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'pending')
  returning id into v_app;

  perform public.admin_approve_founding_pro_application(v_app);

  begin
    perform public.admin_approve_founding_pro_application(v_app);
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (5): an already-approved application was approved again';
  end if;

  raise notice 'FOUNDING PRO ADMIN TEST (5) PASSED: an already-approved application cannot be approved again';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 6. An enrolled application cannot be reverted through approve/reject.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_failed_approve boolean := false;
  v_failed_reject boolean := false;
begin
  insert into public.founding_pro_applications (user_id, status, reviewed_at)
  values ('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'enrolled', now())
  returning id into v_app;

  begin
    perform public.admin_approve_founding_pro_application(v_app);
  exception when others then
    v_failed_approve := true;
  end;

  begin
    perform public.admin_reject_founding_pro_application(v_app);
  exception when others then
    v_failed_reject := true;
  end;

  if not v_failed_approve or not v_failed_reject then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (6): an enrolled application was reverted via approve/reject';
  end if;

  if (select status from public.founding_pro_applications where id = v_app) <> 'enrolled' then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (6): enrolled application status was changed';
  end if;

  raise notice 'FOUNDING PRO ADMIN TEST (6) PASSED: an enrolled application cannot be reverted through approve or reject';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 7. Structural grant checks (read-only): anon is blocked from every new
--    function; the two mutation RPCs' bodies actually check
--    is_platform_admin() and lock the row (FOR UPDATE) before mutating.
-- ---------------------------------------------------------------------

do $$
declare
  v_approve_def text;
  v_reject_def text;
begin
  if has_function_privilege('anon', 'public.admin_list_founding_pro_applications()', 'EXECUTE') then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (7): anon can execute admin_list_founding_pro_applications';
  end if;
  if has_function_privilege('anon', 'public.admin_list_founding_pro_members()', 'EXECUTE') then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (7): anon can execute admin_list_founding_pro_members';
  end if;
  if has_function_privilege('anon', 'public.admin_list_founding_pro_events()', 'EXECUTE') then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (7): anon can execute admin_list_founding_pro_events';
  end if;
  if has_function_privilege('anon', 'public.admin_approve_founding_pro_application(uuid,text)', 'EXECUTE') then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (7): anon can execute admin_approve_founding_pro_application';
  end if;
  if has_function_privilege('anon', 'public.admin_reject_founding_pro_application(uuid,text)', 'EXECUTE') then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (7): anon can execute admin_reject_founding_pro_application';
  end if;

  v_approve_def := pg_get_functiondef('public.admin_approve_founding_pro_application(uuid,text)'::regprocedure);
  v_reject_def := pg_get_functiondef('public.admin_reject_founding_pro_application(uuid,text)'::regprocedure);

  if v_approve_def not like '%is_platform_admin()%' or lower(v_approve_def) not like '%for update%' then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (7): admin_approve_founding_pro_application no longer admin-gated/row-locked';
  end if;
  if v_reject_def not like '%is_platform_admin()%' or lower(v_reject_def) not like '%for update%' then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (7): admin_reject_founding_pro_application no longer admin-gated/row-locked';
  end if;

  raise notice 'FOUNDING PRO ADMIN TEST (7) PASSED: anon is grant-blocked from all 5 new functions; both mutation RPCs are admin-gated and row-locked';
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Audit records written by approve/reject remain append-only — same
--    trigger Phase 1 already proved, re-verified here against a row
--    this phase's own RPCs actually created.
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_event_id uuid;
  v_update_failed boolean := false;
  v_delete_failed boolean := false;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'pending')
  returning id into v_app;

  perform public.admin_approve_founding_pro_application(v_app);

  select id into v_event_id from public.founding_pro_events where application_id = v_app and event_type = 'application_approved';

  begin
    update public.founding_pro_events set metadata = '{"tampered":true}'::jsonb where id = v_event_id;
  exception when others then
    v_update_failed := true;
  end;

  begin
    delete from public.founding_pro_events where id = v_event_id;
  exception when others then
    v_delete_failed := true;
  end;

  if not v_update_failed or not v_delete_failed then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (8): an audit event written by admin_approve_founding_pro_application was modified/deleted';
  end if;

  raise notice 'FOUNDING PRO ADMIN TEST (8) PASSED: audit events created by the approval RPC remain append-only';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 9. Read RPCs execute successfully for an admin and return the
--    expected joined shape (applicant email/name resolved via profiles).
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_app uuid;
  v_row record;
begin
  insert into public.founding_pro_applications (user_id, status)
  values ('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'pending')
  returning id into v_app;

  select * into v_row from public.admin_list_founding_pro_applications() where id = v_app;
  if v_row.applicant_email is null then
    raise exception 'FOUNDING PRO ADMIN TEST FAILED (9): admin_list_founding_pro_applications did not resolve applicant_email';
  end if;

  -- Members/events RPCs execute without error for an admin (existing
  -- rows are real production data; only asserting the call succeeds).
  perform * from public.admin_list_founding_pro_members();
  perform * from public.admin_list_founding_pro_events();

  raise notice 'FOUNDING PRO ADMIN TEST (9) PASSED: all three read RPCs execute for an admin and resolve applicant identity via profiles';
end;
$$;

rollback;
