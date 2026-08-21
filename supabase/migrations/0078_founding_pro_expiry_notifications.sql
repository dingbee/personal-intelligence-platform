-- ARRIYIA Commercial Readiness — Founding Pro expiry lifecycle
-- notifications (30/7/1 days pre-expiry + at expiry/transition).
--
-- Reuses the EXISTING notifications table/bell (0068) exclusively — no
-- second notification system. Two distinct signal sources:
--
--   1. Pre-expiry warnings (30/7/1 days remaining) are a passage-of-time
--      fact, not a state transition, so they need their own scheduled
--      sweep (notify_founding_pro_expiry_warnings, pg_cron daily,
--      mirroring expire_founding_pro_members's own 0072 scheduling
--      precedent exactly) and their own dedup ledger
--      (founding_pro_expiry_notifications) keyed on
--      (member_id, threshold_days) — a membership row's founding period
--      (founding_started_at/founding_expires_at) is fixed at enrollment
--      and never mutated except transition_status/transitioned_at, so
--      member_id alone already scopes dedup to "this founding period,"
--      satisfying "deduplicated per member+threshold+founding-period"
--      without a separate period column.
--
--   2. The expiry/transition notification itself has a real state-change
--      event to attach to — expire_founding_pro_members() (0072) and
--      apply_subscription_event() (0074, true 13-param signature) already
--      run exactly once per member transition, inside the same
--      transaction as the transition_status write, so a notification
--      insert there is deduplicated for free by the same WHERE-clause
--      idempotency that already makes both functions safe to re-run
--      (a transitioned row is never selected/matched again). Both
--      functions are re-declared with CREATE OR REPLACE, preserving every
--      existing line of logic verbatim (confirmed against 0072's and
--      0074's own live bodies before writing this), adding exactly one
--      notification insert each, in the branch that actually performs the
--      transition.
--
-- Copy lives in the payload only (quota_key-style raw data); user-facing
-- text is rendered by NotificationBell.tsx's describeNotification(),
-- matching this migration's own quota_threshold_notifications precedent
-- (0077) of keeping DB payloads technical and translation client-side.

-- ---------------------------------------------------------------------
-- 1. founding_pro_expiry_notifications — dedup ledger for the pre-expiry
--    warning sweep. Zero client policies of any kind (not even a SELECT
--    policy) — this is purely an internal scheduler dedup ledger, not
--    user-facing data; the resulting notification is what the user reads,
--    via the notifications table's own existing RLS.
-- ---------------------------------------------------------------------

create table public.founding_pro_expiry_notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.founding_pro_members (id) on delete cascade,
  threshold_days smallint not null,
  created_at timestamptz not null default now(),
  constraint founding_pro_expiry_notifications_unique unique (member_id, threshold_days)
);

alter table public.founding_pro_expiry_notifications enable row level security;

-- ---------------------------------------------------------------------
-- 2. notify_founding_pro_expiry_warnings() — daily sweep, 30/7/1 days
--    remaining. Scheduler-only, same grant posture as
--    expire_founding_pro_members(): no client grant of any kind.
-- ---------------------------------------------------------------------

create or replace function public.notify_founding_pro_expiry_warnings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_notified_count int := 0;
begin
  for v_row in
    select fpm.id as member_id, fpm.user_id, fpm.founding_expires_at, t.days as threshold_days
    from public.founding_pro_members fpm
    cross join (values (30), (7), (1)) as t(days)
    where fpm.transition_status = 'active'
      and fpm.founding_expires_at > now()
      and fpm.founding_expires_at <= now() + (t.days || ' days')::interval
      and not exists (
        select 1 from public.founding_pro_expiry_notifications n
        where n.member_id = fpm.id and n.threshold_days = t.days
      )
  loop
    insert into public.founding_pro_expiry_notifications (member_id, threshold_days)
    values (v_row.member_id, v_row.threshold_days)
    on conflict (member_id, threshold_days) do nothing;

    if found then
      insert into public.notifications (recipient_user_id, type, payload)
      values (
        v_row.user_id,
        'founding_pro_expiry_warning',
        jsonb_build_object(
          'member_id', v_row.member_id,
          'threshold_days', v_row.threshold_days,
          'founding_expires_at', v_row.founding_expires_at
        )
      );
      v_notified_count := v_notified_count + 1;
    end if;
  end loop;

  return jsonb_build_object('outcome', 'processed', 'notified', v_notified_count);
end;
$$;

revoke all on function public.notify_founding_pro_expiry_warnings() from public, anon, authenticated;

select cron.schedule(
  'notify-founding-pro-expiry-warnings',
  '0 8 * * *',
  $$select public.notify_founding_pro_expiry_warnings();$$
);

-- ---------------------------------------------------------------------
-- 3. expire_founding_pro_members() — re-declared, preserving every
--    existing line from 0072 verbatim, adding one notification insert in
--    the 'expired_to_free' branch only (the 'converted_to_pro' branch
--    here is a reconciliation of a conversion that already happened
--    elsewhere and already notified via apply_subscription_event below —
--    notifying again here would be a duplicate for the same real event;
--    the 'admin_action' deferral branch is an administrator's own
--    decision, not a Founding-Pro-lifecycle event the member needs to be
--    told about here).
-- ---------------------------------------------------------------------

create or replace function public.expire_founding_pro_members()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_free_plan_id uuid;
  v_pro_plan_id uuid;
  v_founding_plan_id uuid;
  v_member record;
  v_current_plan_id uuid;
  v_expired_count int := 0;
  v_converted_count int := 0;
  v_deferred_count int := 0;
begin
  select id into v_free_plan_id from public.plans where code = 'free';
  select id into v_pro_plan_id from public.plans where code = 'pro';
  select id into v_founding_plan_id from public.plans where code = 'founding_pro';

  if v_free_plan_id is null or v_founding_plan_id is null then
    raise exception 'expire_founding_pro_members: required plan rows (free/founding_pro) are not configured';
  end if;

  for v_member in
    select m.id, m.user_id
    from public.founding_pro_members m
    where m.transition_status = 'active'
      and m.founding_expires_at <= now()
    order by m.id
    for update of m skip locked
  loop
    select upa.plan_id into v_current_plan_id
    from public.user_plan_assignments upa
    where upa.user_id = v_member.user_id and upa.active = true
    limit 1;

    if v_current_plan_id is not distinct from v_founding_plan_id then
      update public.user_plan_assignments
      set active = false, ends_at = now()
      where user_id = v_member.user_id and active = true;

      insert into public.user_plan_assignments (user_id, plan_id, active)
      values (v_member.user_id, v_free_plan_id, true);

      update public.founding_pro_members
      set transition_status = 'expired_to_free', transitioned_at = now()
      where id = v_member.id;

      insert into public.founding_pro_events (event_type, member_id, target_user_id, metadata)
      values (
        'expired_to_free',
        v_member.id,
        v_member.user_id,
        jsonb_build_object('reason', 'term_expired', 'processed_at', now())
      );

      insert into public.notifications (recipient_user_id, type, payload)
      values (
        v_member.user_id,
        'founding_pro_transition',
        jsonb_build_object('member_id', v_member.id, 'transition_status', 'expired_to_free')
      );

      v_expired_count := v_expired_count + 1;

    elsif v_pro_plan_id is not null and v_current_plan_id is not distinct from v_pro_plan_id then
      update public.founding_pro_members
      set transition_status = 'converted_to_pro', transitioned_at = now()
      where id = v_member.id;

      insert into public.founding_pro_events (event_type, member_id, target_user_id, metadata)
      values (
        'converted_to_pro',
        v_member.id,
        v_member.user_id,
        jsonb_build_object('reason', 'detected_during_expiry_sweep', 'processed_at', now())
      );

      v_converted_count := v_converted_count + 1;

    else
      insert into public.founding_pro_events (event_type, member_id, target_user_id, metadata)
      values (
        'admin_action',
        v_member.id,
        v_member.user_id,
        jsonb_build_object(
          'reason', 'expiry_sweep_deferred_to_existing_plan_change',
          'current_plan_id', v_current_plan_id,
          'processed_at', now()
        )
      );

      v_deferred_count := v_deferred_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'outcome', 'processed',
    'expired_to_free', v_expired_count,
    'converted_to_pro', v_converted_count,
    'deferred_to_admin_change', v_deferred_count
  );
end;
$$;

revoke all on function public.expire_founding_pro_members() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. apply_subscription_event() — re-declared under the TRUE live
--    13-param signature (0074), preserving every existing line verbatim,
--    adding one notification insert exactly where the existing Founding
--    Pro conversion bookkeeping already fires (v_founding_member_id is
--    not null — i.e. this event really did just convert a live Founding
--    Pro member to Pro).
-- ---------------------------------------------------------------------

create or replace function public.apply_subscription_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_plan_code text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_timestamp timestamptz,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_free_plan_id uuid;
  v_subscription_id uuid;
  v_existing_last_event_at timestamptz;
  v_founding_member_id uuid;
begin
  if exists (
    select 1 from public.subscription_events
    where provider = p_provider and provider_event_id = p_provider_event_id
  ) then
    return jsonb_build_object('outcome', 'duplicate_ignored');
  end if;

  select id into v_plan_id from public.plans where code = p_plan_code;
  if v_plan_id is null then
    insert into public.subscription_events (provider, provider_event_id, event_type, processing_status, raw_payload)
    values (p_provider, p_provider_event_id, p_event_type, 'failed', p_raw_payload);
    raise exception 'apply_subscription_event: unknown plan code %', p_plan_code;
  end if;

  insert into public.billing_customers (user_id, provider, provider_customer_id)
  values (p_user_id, p_provider, p_provider_customer_id)
  on conflict (user_id, provider) do update
    set provider_customer_id = excluded.provider_customer_id, updated_at = now();

  select id, last_event_at into v_subscription_id, v_existing_last_event_at
  from public.subscriptions
  where provider = p_provider and provider_subscription_id = p_provider_subscription_id;

  if v_subscription_id is not null and v_existing_last_event_at is not null
     and p_event_timestamp < v_existing_last_event_at then
    insert into public.subscription_events (provider, provider_event_id, event_type, processing_status, raw_payload, subscription_id)
    values (p_provider, p_provider_event_id, p_event_type, 'ignored_stale', p_raw_payload, v_subscription_id);
    return jsonb_build_object('outcome', 'stale_ignored', 'subscription_id', v_subscription_id);
  end if;

  insert into public.subscriptions (
    user_id, plan_id, provider, provider_subscription_id, provider_price_id, status,
    current_period_start, current_period_end, cancel_at_period_end, last_event_at
  )
  values (
    p_user_id, v_plan_id, p_provider, p_provider_subscription_id, p_plan_code, p_status,
    p_current_period_start, p_current_period_end, p_cancel_at_period_end, p_event_timestamp
  )
  on conflict (provider, provider_subscription_id) do update
    set plan_id = excluded.plan_id,
        status = excluded.status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end,
        last_event_at = excluded.last_event_at,
        updated_at = now()
  returning id into v_subscription_id;

  if p_status in ('active', 'past_due') then
    if not exists (
      select 1 from public.user_plan_assignments
      where user_id = p_user_id and active = true and plan_id = v_plan_id
    ) then
      update public.user_plan_assignments
      set active = false, ends_at = now()
      where user_id = p_user_id and active = true;

      insert into public.user_plan_assignments (user_id, plan_id, active)
      values (p_user_id, v_plan_id, true);
    end if;

    if p_plan_code = 'pro' then
      update public.founding_pro_members
      set transition_status = 'converted_to_pro', transitioned_at = now()
      where user_id = p_user_id and transition_status = 'active'
      returning id into v_founding_member_id;

      if v_founding_member_id is not null then
        insert into public.founding_pro_events (event_type, member_id, actor_user_id, target_user_id, metadata)
        values (
          'converted_to_pro',
          v_founding_member_id,
          p_user_id,
          p_user_id,
          jsonb_build_object('source', 'apply_subscription_event', 'provider', p_provider, 'provider_subscription_id', p_provider_subscription_id)
        );

        insert into public.notifications (recipient_user_id, type, payload)
        values (
          p_user_id,
          'founding_pro_transition',
          jsonb_build_object('member_id', v_founding_member_id, 'transition_status', 'converted_to_pro')
        );
      end if;
    end if;
  elsif p_status in ('cancelled', 'expired') then
    select id into v_free_plan_id from public.plans where code = 'free';
    if v_free_plan_id is not null and not exists (
      select 1 from public.user_plan_assignments
      where user_id = p_user_id and active = true and plan_id = v_free_plan_id
    ) then
      update public.user_plan_assignments
      set active = false, ends_at = now()
      where user_id = p_user_id and active = true;

      insert into public.user_plan_assignments (user_id, plan_id, active)
      values (p_user_id, v_free_plan_id, true);
    end if;
  end if;

  insert into public.subscription_events (provider, provider_event_id, event_type, processing_status, raw_payload, subscription_id)
  values (p_provider, p_provider_event_id, p_event_type, 'processed', p_raw_payload, v_subscription_id);

  return jsonb_build_object('outcome', 'applied', 'subscription_id', v_subscription_id, 'plan_id', v_plan_id);
end;
$$;

revoke all on function public.apply_subscription_event(
  text, text, text, uuid, text, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, jsonb
) from public, anon, authenticated;
