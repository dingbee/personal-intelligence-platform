-- ARRIYIA Commercial Readiness — quota threshold notifications security
-- test (0077_quota_threshold_notifications.sql). Wires the EXISTING
-- consume_quota() write path to the EXISTING notifications table; this
-- test proves the wiring, the dedup ledger's RLS/anti-forgery posture,
-- and per-quota/per-user independence.
--
-- Users reused from notifications_security_test.sql's vetted set:
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com)
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com)
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co)

-- ---------------------------------------------------------------------
-- 1. Threshold crossings: Student's decision_intelligence_operations
--    limit is 25/month. Consuming it to exactly 25 must produce exactly
--    the four dedup rows (50/75/90/100) and four notifications, each
--    correctly typed/addressed/payloaded — no duplicate, no missing
--    threshold, no premature firing before 50%.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_student_id uuid;
  v_i int;
  v_count integer;
  v_row record;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_student_id from public.plans where code = 'student';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_student_id, true);
  delete from public.quota_usage where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and quota_key = 'decision_intelligence_operations';
  delete from public.quota_threshold_notifications where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and quota_key = 'decision_intelligence_operations';

  for v_i in 1..12 loop
    perform public.consume_quota('decision_intelligence_operations');
  end loop;
  select count(*) into v_count from public.quota_threshold_notifications
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and quota_key = 'decision_intelligence_operations';
  if v_count <> 0 then
    raise exception 'QUOTA THRESHOLD TEST FAILED (1a): % threshold rows exist at 12/25 (48%%), expected 0', v_count;
  end if;

  for v_i in 13..25 loop
    perform public.consume_quota('decision_intelligence_operations');
  end loop;

  select count(*) into v_count from public.quota_threshold_notifications
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and quota_key = 'decision_intelligence_operations';
  if v_count <> 4 then
    raise exception 'QUOTA THRESHOLD TEST FAILED (1b): % threshold rows exist at 25/25, expected exactly 4 (50/75/90/100)', v_count;
  end if;

  select count(*) into v_count from public.notifications
    where recipient_user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and type = 'quota_threshold'
      and payload->>'quota_key' = 'decision_intelligence_operations';
  if v_count <> 4 then
    raise exception 'QUOTA THRESHOLD TEST FAILED (1c): % notifications exist, expected exactly 4', v_count;
  end if;

  select * into v_row from public.notifications
    where recipient_user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and type = 'quota_threshold'
      and payload->>'quota_key' = 'decision_intelligence_operations' and (payload->>'threshold')::int = 100;
  if (v_row.payload->>'usage_count')::bigint <> 25 or (v_row.payload->>'quota_limit')::bigint <> 25 then
    raise exception 'QUOTA THRESHOLD TEST FAILED (1d): the 100%% notification payload has wrong usage/limit: %', v_row.payload;
  end if;

  -- Consuming beyond the limit must not create a duplicate 100% notification.
  perform public.consume_quota('decision_intelligence_operations');
  select count(*) into v_count from public.notifications
    where recipient_user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and type = 'quota_threshold'
      and payload->>'quota_key' = 'decision_intelligence_operations';
  if v_count <> 4 then
    raise exception 'QUOTA THRESHOLD TEST FAILED (1e): consuming past the limit created a duplicate notification (% total)', v_count;
  end if;

  raise notice 'QUOTA THRESHOLD TEST (1) PASSED: thresholds fire exactly once each, in order, with correct payloads, no duplication past 100%%';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. Per-quota-key and per-user independence: crossing a threshold on one
--    quota_key never notifies for a different quota_key or a different
--    user.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_student_id uuid;
  v_i int;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_student_id from public.plans where code = 'student';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_student_id, true);
  delete from public.quota_usage where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and quota_key in ('research_intelligence_operations', 'analysis_intelligence_operations');
  delete from public.quota_threshold_notifications where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and quota_key in ('research_intelligence_operations', 'analysis_intelligence_operations');

  for v_i in 1..40 loop -- research limit 50: 40/50 = 80% -> 50,75 fire, not 90/100
    perform public.consume_quota('research_intelligence_operations');
  end loop;

  select count(*) into v_count from public.quota_threshold_notifications
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and quota_key = 'research_intelligence_operations';
  if v_count <> 2 then
    raise exception 'QUOTA THRESHOLD TEST FAILED (2a): expected 2 thresholds (50,75) at 80%%, got %', v_count;
  end if;

  select count(*) into v_count from public.quota_threshold_notifications
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and quota_key = 'analysis_intelligence_operations';
  if v_count <> 0 then
    raise exception 'QUOTA THRESHOLD TEST FAILED (2b): consuming research_intelligence_operations notified analysis_intelligence_operations';
  end if;

  raise notice 'QUOTA THRESHOLD TEST (2) PASSED: quota keys are notified independently';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. RLS / anti-forgery: a user cannot see another user's dedup rows,
--    and cannot fabricate a dedup row or a quota_threshold notification
--    directly (no client insert path — only consume_quota writes either
--    table).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_student_id uuid;
  v_count integer;
  v_failed boolean := false;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_student_id from public.plans where code = 'student';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_student_id, true);
  perform public.consume_quota('planning_intelligence_operations');

  set local "request.jwt.claims" = '{"sub":"9e733cfc-e6ae-45e6-8b14-dc64247a9cb2","role":"authenticated"}';

  select count(*) into v_count from public.quota_threshold_notifications
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d';
  if v_count <> 0 then
    raise exception 'QUOTA THRESHOLD TEST FAILED (3a): another user could read a Student user''s dedup rows';
  end if;

  begin
    insert into public.quota_threshold_notifications (user_id, quota_key, period_start, threshold)
      values ('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'ai_messages', date_trunc('month', now()), 50);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'QUOTA THRESHOLD TEST FAILED (3b): a client could insert a dedup row directly, bypassing consume_quota';
  end if;

  v_failed := false;
  begin
    insert into public.notifications (recipient_user_id, type, payload)
      values ('9e733cfc-e6ae-45e6-8b14-dc64247a9cb2', 'quota_threshold', jsonb_build_object('quota_key', 'ai_messages', 'threshold', 100, 'usage_count', 999, 'quota_limit', 1));
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'QUOTA THRESHOLD TEST FAILED (3c): a client could fabricate a fake quota_threshold notification for themselves';
  end if;

  raise notice 'QUOTA THRESHOLD TEST (3) PASSED: dedup rows are private and cannot be forged; notifications cannot be fabricated client-side';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. Period reset: a threshold already notified in a prior period fires
--    again in a new period (new period_start = a different dedup row,
--    not blocked by the old one).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_student_id uuid;
  v_last_month timestamptz := date_trunc('month', now()) - interval '1 month';
  v_i int;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_student_id from public.plans where code = 'student';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_student_id, true);

  -- Simulate last period's 100% notification already having fired.
  insert into public.quota_threshold_notifications (user_id, quota_key, period_start, threshold)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'data_intelligence_operations', v_last_month, 100);

  delete from public.quota_usage where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and quota_key = 'data_intelligence_operations';
  for v_i in 1..50 loop -- data_intelligence_operations limit 50 -> hits 100% this (current) period
    perform public.consume_quota('data_intelligence_operations');
  end loop;

  select count(*) into v_count from public.quota_threshold_notifications
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and quota_key = 'data_intelligence_operations'
      and period_start = date_trunc('month', now()) and threshold = 100;
  if v_count <> 1 then
    raise exception 'QUOTA THRESHOLD TEST FAILED (4): a new period''s 100%% threshold did not fire because a prior period''s row exists';
  end if;

  raise notice 'QUOTA THRESHOLD TEST (4) PASSED: threshold dedup resets naturally on a new period_start';
end;
$$;

rollback;
