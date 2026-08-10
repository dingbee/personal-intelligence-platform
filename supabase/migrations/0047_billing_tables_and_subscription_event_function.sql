-- Phase 4 Commercial Architecture — billing tables + secure subscription
-- event application.
--
-- Architectural separation (payment provider never determines feature
-- access directly):
--
--   payment provider -> webhook edge function -> subscription_events
--     -> subscriptions -> user_plan_assignments (existing, unchanged
--     mechanism) -> plans/plan_quotas (existing, unchanged) ->
--     entitlement resolution (existing, unchanged) -> feature access
--
-- subscriptions explains *why* a user is on a plan (the billing
-- relationship); user_plan_assignments remains the *only* place that
-- actually grants entitlement, using the exact deactivate-old/
-- insert-new pattern admin_change_user_plan already uses — nothing new
-- there. Plan/quota data is never duplicated into subscriptions.

create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customers_user_provider_key unique (user_id, provider),
  constraint billing_customers_provider_customer_key unique (provider, provider_customer_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  provider text not null,
  provider_subscription_id text not null,
  provider_price_id text,
  status text not null check (status in ('active', 'past_due', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- last provider-event timestamp actually applied to this row — the
  -- out-of-order-webhook guard in apply_subscription_event() below
  -- compares an incoming event's timestamp against this before applying
  -- it, so a delayed/replayed older event can never clobber newer state.
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_provider_subscription_key unique (provider, provider_subscription_id)
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  subscription_id uuid references public.subscriptions(id),
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processed', 'ignored_stale', 'failed')),
  raw_payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  -- The idempotency mechanism: a webhook redelivering the same event
  -- collides on this and apply_subscription_event() returns
  -- 'duplicate_ignored' without reprocessing.
  constraint subscription_events_provider_event_key unique (provider, provider_event_id)
);

create index subscription_events_subscription_id_idx on public.subscription_events (subscription_id);

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;

create policy "Users can view their own billing customer record"
  on public.billing_customers for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own subscriptions"
  on public.subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- subscription_events has zero client policies, matching beta_invites'
-- established pattern for tables that must never be directly readable
-- or writable by end users — the only access paths are
-- apply_subscription_event() (service-role only, below) and the admin
-- RPC at the end of this file.

revoke insert, update, delete, truncate on public.billing_customers from anon, authenticated;
revoke select, insert, update, delete, truncate on public.billing_customers from anon;
revoke insert, update, delete, truncate on public.subscriptions from anon, authenticated;
revoke select, insert, update, delete, truncate on public.subscriptions from anon;
revoke select, insert, update, delete, truncate on public.subscription_events from anon, authenticated;

-- ---------------------------------------------------------------------
-- apply_subscription_event() — the single, service-role-only write path
-- for subscription state and the entitlement it grants. This is the
-- concrete answer to "never give authenticated users an RPC that lets
-- them assign themselves Pro": EXECUTE is granted to service_role only,
-- never to anon or authenticated, so no client-reachable path can call
-- this function under any circumstances — not a permission check inside
-- the function body (which a bug could weaken), a structural grant.
--
-- p_plan_code is resolved against the real `plans` table (never trusted
-- as a plan_id, and unknown codes fail loudly) — the webhook edge
-- function's own adapter layer is responsible for mapping a payment
-- provider's price/product ID to this code before calling here, so a
-- provider payload can never name an ARRIYIA plan directly.
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
begin
  -- Idempotency: a redelivered event is a no-op, not an error.
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

  -- Out-of-order guard: an older event arriving late is recorded for
  -- audit but never applied over newer state.
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

  -- Reflect into user_plan_assignments using the exact existing
  -- deactivate-old/insert-new pattern admin_change_user_plan already
  -- uses — the entitlement mechanism itself is untouched.
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
  -- cancel_at_period_end = true while status is still 'active': access
  -- continues at the current (already-assigned) plan — no assignment
  -- change until a later event actually flips status to
  -- cancelled/expired at period end.

  insert into public.subscription_events (provider, provider_event_id, event_type, processing_status, raw_payload, subscription_id)
  values (p_provider, p_provider_event_id, p_event_type, 'processed', p_raw_payload, v_subscription_id);

  return jsonb_build_object('outcome', 'applied', 'subscription_id', v_subscription_id, 'plan_id', v_plan_id);
end;
$$;

revoke all on function public.apply_subscription_event(
  text, text, text, uuid, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(
  text, text, text, uuid, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, jsonb
) to service_role;

-- ---------------------------------------------------------------------
-- Minimal admin visibility RPC — support needs to see a user's billing
-- state without being able to mutate it (mutation stays exclusively on
-- apply_subscription_event via the webhook, or the existing
-- admin_change_user_plan for manual override, per the conflict policy
-- documented in the Phase 4 final report: webhook-driven fields are
-- authoritative going forward, and a manual admin plan change is an
-- explicit, logged override that the next real webhook can still
-- supersede).
-- ---------------------------------------------------------------------

create or replace function public.admin_get_user_subscription(p_user_id uuid)
returns table (
  provider text,
  provider_subscription_id text,
  plan_code text,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select s.provider, s.provider_subscription_id, p.code, s.status,
      s.current_period_start, s.current_period_end, s.cancel_at_period_end, s.updated_at
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.user_id = p_user_id
    order by s.updated_at desc;
end;
$$;

revoke execute on function public.admin_get_user_subscription(uuid) from public, anon;
grant execute on function public.admin_get_user_subscription(uuid) to authenticated;
