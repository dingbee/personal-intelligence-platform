-- Phase 5B — Pesapal Sandbox Billing: security + state-machine
-- verification. Two parts:
--
-- PART 1 (structural, read-only, safe to run anytime): grant/RLS checks
-- proving no ordinary authenticated user can upgrade themselves, assign
-- themselves any plan, or read another user's checkout orders.
--
-- PART 2 (state-machine, in a transaction that ALWAYS rolls back): drives
-- a synthetic user through the full FREE -> PRO_ACTIVE -> PRO_PAST_DUE ->
-- PRO_ACTIVE -> PRO_CANCELLED_PENDING -> FREE lifecycle through
-- apply_subscription_event() — the exact same, unmodified-since-Phase-4
-- function pesapal-ipn calls — and a duplicate-event idempotency check.
-- The `begin; ... rollback;` wrapper means this leaves zero rows behind
-- in production regardless of outcome; it is not a mock, it is the real
-- function running against a real (synthetic, immediately-discarded) user
-- row, which is what makes this a genuine state-machine test rather than
-- a restatement of the function's own code.
--
-- Executed live against production (project uzshazetfkjkrdnxwjtl) on
-- 2026-08-10; all assertions passed; the transaction was rolled back.

-- ---------------------------------------------------------------------
-- PART 1 — structural security checks
-- ---------------------------------------------------------------------

do $$
begin
  -- No ordinary user can insert/update their own checkout order (only
  -- pesapal-checkout's service-role client can — this is what stops a
  -- client from forging amount_cents/plan_code/order_tracking_id).
  if has_table_privilege('authenticated', 'public.pesapal_checkout_orders', 'INSERT') then
    raise exception 'PESAPAL SECURITY FAILED: authenticated can INSERT pesapal_checkout_orders';
  end if;
  if has_table_privilege('authenticated', 'public.pesapal_checkout_orders', 'UPDATE') then
    raise exception 'PESAPAL SECURITY FAILED: authenticated can UPDATE pesapal_checkout_orders';
  end if;
  if has_table_privilege('anon', 'public.pesapal_checkout_orders', 'SELECT') then
    raise exception 'PESAPAL SECURITY FAILED: anon can SELECT pesapal_checkout_orders';
  end if;

  -- The RLS policy itself must scope SELECT to the caller's own rows —
  -- structurally verified (not just "a policy exists") so a future
  -- migration weakening it to `using (true)` would be caught here.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pesapal_checkout_orders'
      and cmd = 'SELECT' and qual like '%auth.uid()%user_id%'
  ) then
    raise exception 'PESAPAL SECURITY FAILED: pesapal_checkout_orders SELECT policy is not scoped to auth.uid() = user_id';
  end if;

  -- apply_subscription_event must remain exactly what Phase 4 built it
  -- as: unreachable by anon/authenticated, service_role only. Pesapal
  -- adds a second caller (pesapal-ipn) but never a second, weaker grant.
  if has_function_privilege('anon', 'public.apply_subscription_event(text,text,text,uuid,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz,jsonb)', 'EXECUTE') then
    raise exception 'PESAPAL SECURITY FAILED: anon can execute apply_subscription_event';
  end if;
  if has_function_privilege('authenticated', 'public.apply_subscription_event(text,text,text,uuid,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz,jsonb)', 'EXECUTE') then
    raise exception 'PESAPAL SECURITY FAILED: authenticated can execute apply_subscription_event — an ordinary user could upgrade themselves';
  end if;
  if not has_function_privilege('service_role', 'public.apply_subscription_event(text,text,text,uuid,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz,jsonb)', 'EXECUTE') then
    raise exception 'PESAPAL SECURITY FAILED: service_role (pesapal-ipn''s only credential) cannot execute apply_subscription_event';
  end if;

  raise notice 'PESAPAL SECURITY (PART 1 — structural) PASSED';
end;
$$;

-- ---------------------------------------------------------------------
-- PART 2 — full state-machine lifecycle, self-cleaning transaction
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'phase5b-sandbox-test-' || gen_random_uuid()::text || '@test.invalid';
  v_pro_id uuid;
  v_free_id uuid;
  v_active_plan_id uuid;
  v_sub_status text;
  v_cancel_at_period_end boolean;
  v_dup_outcome text;
begin
  select id into v_pro_id from public.plans where code = 'pro';
  select id into v_free_id from public.plans where code = 'free';

  -- auth.users has a beta-invite gate trigger (enforce_beta_invite_gate,
  -- 0033_beta_gate.sql-era) that rejects an insert unless a matching
  -- beta_invites row exists first — discovered live while first running
  -- this test. Both rows are rolled back together with everything else.
  insert into public.beta_invites (email, status) values (v_email, 'invited');

  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  values (v_user_id, v_email, '', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.user_plan_assignments (user_id, plan_id, active) values (v_user_id, v_free_id, true);

  -- FREE -> PRO_ACTIVE (successful sandbox payment)
  perform public.apply_subscription_event(
    'pesapal', 'test-track-1:1', 'pesapal.transaction.status_1', v_user_id, v_user_id::text, 'test-track-1',
    'pro', 'active', now(), now() + interval '1 month', false, now(), '{}'::jsonb
  );
  select plan_id into v_active_plan_id from public.user_plan_assignments where user_id = v_user_id and active = true;
  if v_active_plan_id <> v_pro_id then
    raise exception 'PESAPAL STATE MACHINE FAILED: FREE -> PRO_ACTIVE did not grant pro (active plan is %)', v_active_plan_id;
  end if;

  -- Duplicate delivery of the SAME event: must not mutate anything twice.
  select (public.apply_subscription_event(
    'pesapal', 'test-track-1:1', 'pesapal.transaction.status_1', v_user_id, v_user_id::text, 'test-track-1',
    'pro', 'active', now(), now() + interval '1 month', false, now(), '{}'::jsonb
  )->>'outcome') into v_dup_outcome;
  if v_dup_outcome <> 'duplicate_ignored' then
    raise exception 'PESAPAL STATE MACHINE FAILED: redelivered event was not deduplicated (outcome=%)', v_dup_outcome;
  end if;

  -- PRO_ACTIVE -> PRO_PAST_DUE (a recurring charge fails) — must NOT
  -- downgrade; access continues per §17.
  perform public.apply_subscription_event(
    'pesapal', 'test-track-1:2', 'pesapal.transaction.status_2', v_user_id, v_user_id::text, 'test-track-1',
    'pro', 'past_due', null, null, false, now() + interval '1 minute', '{}'::jsonb
  );
  select plan_id into v_active_plan_id from public.user_plan_assignments where user_id = v_user_id and active = true;
  if v_active_plan_id <> v_pro_id then
    raise exception 'PESAPAL STATE MACHINE FAILED: PRO_PAST_DUE incorrectly downgraded the user (active plan is %)', v_active_plan_id;
  end if;
  select status into v_sub_status from public.subscriptions where provider = 'pesapal' and provider_subscription_id = 'test-track-1';
  if v_sub_status <> 'past_due' then
    raise exception 'PESAPAL STATE MACHINE FAILED: subscriptions.status did not record past_due (got %)', v_sub_status;
  end if;

  -- PRO_PAST_DUE -> PRO_ACTIVE (successful retry)
  perform public.apply_subscription_event(
    'pesapal', 'test-track-1:1r', 'pesapal.transaction.status_1', v_user_id, v_user_id::text, 'test-track-1',
    'pro', 'active', now(), now() + interval '1 month', false, now() + interval '2 minutes', '{}'::jsonb
  );
  select status into v_sub_status from public.subscriptions where provider = 'pesapal' and provider_subscription_id = 'test-track-1';
  if v_sub_status <> 'active' then
    raise exception 'PESAPAL STATE MACHINE FAILED: successful retry did not restore active status (got %)', v_sub_status;
  end if;

  -- Cancellation requested: cancel_at_period_end=true while status stays
  -- 'active' — user must remain on Pro (§16).
  perform public.apply_subscription_event(
    'pesapal', 'test-track-1:cancelreq', 'pesapal.subscription.cancel_requested', v_user_id, v_user_id::text, 'test-track-1',
    'pro', 'active', now(), now() + interval '1 month', true, now() + interval '3 minutes', '{}'::jsonb
  );
  select plan_id into v_active_plan_id from public.user_plan_assignments where user_id = v_user_id and active = true;
  select cancel_at_period_end into v_cancel_at_period_end from public.subscriptions where provider = 'pesapal' and provider_subscription_id = 'test-track-1';
  if v_active_plan_id <> v_pro_id then
    raise exception 'PESAPAL STATE MACHINE FAILED: cancel-requested (cancel_at_period_end=true) incorrectly downgraded the user immediately';
  end if;
  if v_cancel_at_period_end is not true then
    raise exception 'PESAPAL STATE MACHINE FAILED: cancel_at_period_end was not recorded as true';
  end if;

  -- Period ends: a terminal 'cancelled' event -> FREE.
  perform public.apply_subscription_event(
    'pesapal', 'test-track-1:3', 'pesapal.transaction.status_3', v_user_id, v_user_id::text, 'test-track-1',
    'pro', 'cancelled', null, null, true, now() + interval '4 minutes', '{}'::jsonb
  );
  select plan_id into v_active_plan_id from public.user_plan_assignments where user_id = v_user_id and active = true;
  if v_active_plan_id <> v_free_id then
    raise exception 'PESAPAL STATE MACHINE FAILED: PRO_CANCELLED_PENDING -> FREE did not occur at period end (active plan is %)', v_active_plan_id;
  end if;

  raise notice 'PESAPAL STATE MACHINE (PART 2) PASSED: FREE -> PRO_ACTIVE -> [dup ignored] -> PRO_PAST_DUE -> PRO_ACTIVE -> PRO_CANCELLED_PENDING (still Pro) -> FREE, all transitions correct';
end;
$$;

rollback;
