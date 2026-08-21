-- ARRIYIA Commercial Readiness — Student plan entitlements security test
-- (0076_student_plan_entitlements.sql). Student's price
-- (26,400 TZS/month, 262,000 TZS/year) is unchanged by this migration and
-- is not exercised here — only plan_quotas/has_feature/collaboration
-- capacity behavior.
--
-- Users reused from notifications_security_test.sql's vetted set:
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com) — Student owner
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com) — invitee 1
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co) — invitee 2

-- ---------------------------------------------------------------------
-- 1. Every target quota_key/quota_limit from the spec resolves exactly,
--    for a real Student-plan user, through resolve_effective_quota_limit
--    (the same function has_feature/quotaService/consume_quota all read).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_student_id uuid;
  v_expected record;
  v_actual bigint;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

  select id into v_student_id from public.plans where code = 'student';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_student_id, true);

  for v_expected in
    select * from (values
      ('feature:pro_intelligence', 1::bigint),
      ('feature:collaboration', 1::bigint),
      ('ai_messages', 750::bigint),
      ('storage_bytes', 5368709120::bigint),
      ('max_active_collaborators', 3::bigint),
      ('max_pending_invitations', 3::bigint),
      ('feature:research_intelligence', 1::bigint),
      ('research_intelligence_operations', 50::bigint),
      ('feature:analysis_intelligence', 1::bigint),
      ('analysis_intelligence_operations', 100::bigint),
      ('feature:data_intelligence', 1::bigint),
      ('data_intelligence_operations', 50::bigint),
      ('feature:decision_intelligence', 1::bigint),
      ('decision_intelligence_operations', 25::bigint),
      ('feature:planning_intelligence', 1::bigint),
      ('planning_intelligence_operations', 25::bigint),
      ('feature:action_intelligence', 0::bigint),
      ('action_intelligence_operations', 0::bigint)
    ) as t(quota_key, quota_limit)
  loop
    select public.resolve_effective_quota_limit('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_expected.quota_key) into v_actual;
    if v_actual is distinct from v_expected.quota_limit then
      raise exception 'STUDENT PLAN TEST FAILED (1): % resolves to % (expected %)', v_expected.quota_key, v_actual, v_expected.quota_limit;
    end if;
  end loop;

  raise notice 'STUDENT PLAN TEST (1) PASSED: every spec quota_key resolves to its exact expected value for a Student user';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. has_feature() semantics match: granted capabilities true, denied
--    (action_intelligence) false — proves Student is wired through the
--    real boolean gate, not a copy-pasted numeric mistake.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_student_id uuid;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_student_id from public.plans where code = 'student';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_student_id, true);

  if not public.has_feature('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'collaboration') then
    raise exception 'STUDENT PLAN TEST FAILED (2): has_feature(collaboration) is false for Student';
  end if;
  if not public.has_feature('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'data_intelligence') then
    raise exception 'STUDENT PLAN TEST FAILED (2): has_feature(data_intelligence) is false for Student';
  end if;
  if public.has_feature('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'action_intelligence') then
    raise exception 'STUDENT PLAN TEST FAILED (2): has_feature(action_intelligence) is true for Student (spec requires denial)';
  end if;

  raise notice 'STUDENT PLAN TEST (2) PASSED: has_feature() grants/denies exactly as specified';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. A Student owner can invite up to 3 active collaborators / 3 pending
--    invitations via the existing invite_to_workspace capacity gate — the
--    same server-side mechanism Free's 1/1 cap already uses — and is
--    denied on the 4th, with the standard capacity error (never a
--    "requires Pro" message, since Student genuinely has the feature).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_student_id uuid;
  v_workspace_id uuid;
  v_failed boolean := false;
  v_error_message text;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_student_id from public.plans where code = 'student';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_student_id, true);

  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Student Capacity Test Workspace')
    returning id into v_workspace_id;

  -- 3 pending invitations to unregistered emails must all succeed.
  perform public.invite_to_workspace(v_workspace_id, 'student-cap-test-1@example.com', 'editor');
  perform public.invite_to_workspace(v_workspace_id, 'student-cap-test-2@example.com', 'editor');
  perform public.invite_to_workspace(v_workspace_id, 'student-cap-test-3@example.com', 'editor');

  begin
    perform public.invite_to_workspace(v_workspace_id, 'student-cap-test-4@example.com', 'editor');
  exception when others then
    v_failed := true;
    get stacked diagnostics v_error_message = message_text;
  end;

  if not v_failed then
    raise exception 'STUDENT PLAN TEST FAILED (3): a 4th pending invitation on Student (cap 3) was not rejected';
  end if;
  if v_error_message ilike '%requires a Pro plan%' or v_error_message ilike '%does not include collaboration%' then
    raise exception 'STUDENT PLAN TEST FAILED (3): the 4th-invitation rejection incorrectly claims Student lacks collaboration entirely: %', v_error_message;
  end if;

  raise notice 'STUDENT PLAN TEST (3) PASSED: Student enforces a real 3-pending-invitation cap via invite_to_workspace, with a capacity (not entitlement-denial) error';
end;
$$;

rollback;
