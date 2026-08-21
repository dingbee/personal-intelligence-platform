-- ARRIYIA Commercial Readiness — Founding Pro expiry lifecycle
-- notifications security test (0078_founding_pro_expiry_notifications.sql).
-- Uses fresh, disposable synthetic auth.users rows (created and rolled
-- back within each test block) rather than the shared vetted-account set,
-- since this test must create/mutate founding_pro_members rows — the one
-- table where reusing a real account risks colliding with a genuine
-- Founding Pro applicant (see notifications_security_test.sql's own
-- warning about 5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1 / engutoto@gmail.com,
-- deliberately avoided by never touching real founding_pro_members rows
-- at all here).

-- ---------------------------------------------------------------------
-- 1. Pre-expiry warning sweep: a member 20 hours from expiry gets all
--    three thresholds (30/7/1) in one sweep run, exactly once each; a
--    second sweep run does not duplicate.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'fp-expiry-test-' || gen_random_uuid()::text || '@test.invalid';
  v_member_id uuid;
  v_founding_id uuid;
  v_count integer;
begin
  select id into v_founding_id from public.plans where code = 'founding_pro';

  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  values (v_user_id, v_email, '', now(), now(), now(), 'authenticated', 'authenticated');

  update public.user_plan_assignments set active = false, ends_at = now() where user_id = v_user_id and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active) values (v_user_id, v_founding_id, true);

  insert into public.founding_pro_members (user_id, slot_type, founding_price_cents, currency, founding_started_at, founding_expires_at, transition_status)
  values (v_user_id, 'public', 1999, 'USD', now() - interval '3 months' + interval '20 hours', now() + interval '20 hours', 'active')
  returning id into v_member_id;

  perform public.notify_founding_pro_expiry_warnings();

  select count(*) into v_count from public.founding_pro_expiry_notifications where member_id = v_member_id;
  if v_count <> 3 then
    raise exception 'FP EXPIRY TEST FAILED (1a): expected 3 dedup rows (30/7/1) for a member 20h from expiry, got %', v_count;
  end if;

  select count(*) into v_count from public.notifications where recipient_user_id = v_user_id and type = 'founding_pro_expiry_warning';
  if v_count <> 3 then
    raise exception 'FP EXPIRY TEST FAILED (1b): expected 3 notifications, got %', v_count;
  end if;

  -- Re-run: must not duplicate.
  perform public.notify_founding_pro_expiry_warnings();
  select count(*) into v_count from public.notifications where recipient_user_id = v_user_id and type = 'founding_pro_expiry_warning';
  if v_count <> 3 then
    raise exception 'FP EXPIRY TEST FAILED (1c): a second sweep run duplicated notifications (% total)', v_count;
  end if;

  raise notice 'FP EXPIRY TEST (1) PASSED: pre-expiry warnings fire once per threshold, no duplication on re-run';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. A member not yet within any threshold window gets no warning.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'fp-expiry-test-' || gen_random_uuid()::text || '@test.invalid';
  v_founding_id uuid;
  v_count integer;
begin
  select id into v_founding_id from public.plans where code = 'founding_pro';
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  values (v_user_id, v_email, '', now(), now(), now(), 'authenticated', 'authenticated');
  update public.user_plan_assignments set active = false, ends_at = now() where user_id = v_user_id and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active) values (v_user_id, v_founding_id, true);

  insert into public.founding_pro_members (user_id, slot_type, founding_price_cents, currency, founding_started_at, founding_expires_at, transition_status)
  values (v_user_id, 'public', 1999, 'USD', now() - interval '1 month', now() + interval '2 months', 'active');

  perform public.notify_founding_pro_expiry_warnings();

  select count(*) into v_count from public.notifications where recipient_user_id = v_user_id and type = 'founding_pro_expiry_warning';
  if v_count <> 0 then
    raise exception 'FP EXPIRY TEST FAILED (2): a member 2 months from expiry received a warning';
  end if;

  raise notice 'FP EXPIRY TEST (2) PASSED: no premature warnings outside the 30/7/1-day windows';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. Expiry transition: expire_founding_pro_members() moves an
--    already-past-term member to Free and sends exactly one
--    'founding_pro_transition' notification with transition_status =
--    'expired_to_free'.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'fp-expiry-test-' || gen_random_uuid()::text || '@test.invalid';
  v_founding_id uuid;
  v_free_id uuid;
  v_member_id uuid;
  v_count integer;
  v_current_plan text;
begin
  select id into v_founding_id from public.plans where code = 'founding_pro';
  select id into v_free_id from public.plans where code = 'free';
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  values (v_user_id, v_email, '', now(), now(), now(), 'authenticated', 'authenticated');
  update public.user_plan_assignments set active = false, ends_at = now() where user_id = v_user_id and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active) values (v_user_id, v_founding_id, true);

  insert into public.founding_pro_members (user_id, slot_type, founding_price_cents, currency, founding_started_at, founding_expires_at, transition_status)
  values (v_user_id, 'public', 1999, 'USD', now() - interval '3 months 1 hour', now() - interval '1 hour', 'active')
  returning id into v_member_id;

  perform public.expire_founding_pro_members();

  select count(*) into v_count from public.notifications
    where recipient_user_id = v_user_id and type = 'founding_pro_transition'
      and payload->>'transition_status' = 'expired_to_free';
  if v_count <> 1 then
    raise exception 'FP EXPIRY TEST FAILED (3a): expected exactly 1 expired_to_free notification, got %', v_count;
  end if;

  select p.code into v_current_plan from public.user_plan_assignments upa join public.plans p on p.id = upa.plan_id
    where upa.user_id = v_user_id and upa.active = true;
  if v_current_plan <> 'free' then
    raise exception 'FP EXPIRY TEST FAILED (3b): member''s active plan is % after expiry, expected free', v_current_plan;
  end if;

  raise notice 'FP EXPIRY TEST (3) PASSED: expiry sweep transitions to Free and notifies exactly once';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. Conversion transition: apply_subscription_event() converting an
--    active Founding Pro member to 'pro' sends exactly one
--    'founding_pro_transition' notification with transition_status =
--    'converted_to_pro' — and this is a genuinely separate event from
--    test 3's expiry notification (never both for the same member).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'fp-expiry-test-' || gen_random_uuid()::text || '@test.invalid';
  v_founding_id uuid;
  v_member_id uuid;
  v_count integer;
begin
  select id into v_founding_id from public.plans where code = 'founding_pro';
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  values (v_user_id, v_email, '', now(), now(), now(), 'authenticated', 'authenticated');
  update public.user_plan_assignments set active = false, ends_at = now() where user_id = v_user_id and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active) values (v_user_id, v_founding_id, true);

  insert into public.founding_pro_members (user_id, slot_type, founding_price_cents, currency, founding_started_at, founding_expires_at, transition_status)
  values (v_user_id, 'public', 1999, 'USD', now() - interval '1 month', now() + interval '2 months', 'active')
  returning id into v_member_id;

  perform public.apply_subscription_event(
    'pesapal', 'fp-expiry-test-evt-' || gen_random_uuid()::text, 'subscription.activated', v_user_id,
    v_user_id::text, 'fp-expiry-test-sub-' || gen_random_uuid()::text, 'pro', 'active',
    now(), now() + interval '1 month', false, now(), '{}'::jsonb
  );

  select count(*) into v_count from public.notifications
    where recipient_user_id = v_user_id and type = 'founding_pro_transition'
      and payload->>'transition_status' = 'converted_to_pro';
  if v_count <> 1 then
    raise exception 'FP EXPIRY TEST FAILED (4a): expected exactly 1 converted_to_pro notification, got %', v_count;
  end if;

  select count(*) into v_count from public.notifications
    where recipient_user_id = v_user_id and type = 'founding_pro_transition'
      and payload->>'transition_status' = 'expired_to_free';
  if v_count <> 0 then
    raise exception 'FP EXPIRY TEST FAILED (4b): a Pro conversion also produced an expired_to_free notification';
  end if;

  raise notice 'FP EXPIRY TEST (4) PASSED: conversion sends exactly one converted_to_pro notification, never an expiry notification';
end;
$$;

rollback;
