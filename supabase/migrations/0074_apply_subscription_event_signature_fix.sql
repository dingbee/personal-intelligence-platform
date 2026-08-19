-- ARRIYIA V1 — apply_subscription_event() signature fix.
--
-- UAT FINDING (caught live during real-project verification, before any
-- real Pesapal event was processed): 0072_founding_pro_expiry.sql's
-- `create or replace function public.apply_subscription_event(...)`
-- copied its parameter list from the repository's own committed
-- 0047_billing_tables_and_subscription_event_function.sql, which
-- includes a `p_provider_price_id text` parameter (13th of 14). The
-- LIVE function — confirmed by direct inspection, and by reading
-- supabase/functions/pesapal-ipn/index.ts's actual `.rpc(...)` call
-- (which passes exactly 13 named parameters and never
-- `p_provider_price_id`) — has never had that parameter. This is a
-- pre-existing drift between the committed 0047 file and what was
-- actually deployed (of a piece with the same repo's already-documented
-- migration-ledger gaps), not something this pass introduced — but this
-- pass's own CREATE OR REPLACE used the wrong (14-param) signature,
-- which Postgres/PostgREST treats as a DIFFERENT, separately-overloaded
-- function rather than a replacement of the real one. The result: two
-- `apply_subscription_event` functions now exist live, and the real one
-- (the 13-param signature `pesapal-ipn` actually calls) was left
-- entirely unmodified — this pass's Founding Pro conversion bookkeeping
-- was attached to a function nothing will ever call.
--
-- Fix: drop the erroneous 14-param overload this pass created, and
-- re-apply the Founding Pro conversion bookkeeping to the TRUE 13-param
-- signature — every other line unchanged from the original live body
-- (confirmed via pg_get_functiondef before this pass touched anything).

drop function if exists public.apply_subscription_event(
  text, text, text, uuid, text, text, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, jsonb
);

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

    -- Founding Pro conversion bookkeeping (0072, re-attached here to the
    -- correct signature). Only ever matches a user both converting to
    -- 'pro' AND currently holding a live ('active') Founding Pro
    -- membership record — a no-op for every other subscription event.
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
