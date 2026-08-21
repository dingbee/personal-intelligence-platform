-- #21 Phase 4.3/4.4/4.5 — Admin Billing & Subscription Operations, Usage &
-- Quota Operations, and the Overview dashboard's commercial/usage summary.
--
-- Every function here is a READ-ONLY view over the existing billing/quota
-- architecture (subscriptions, pesapal_checkout_orders, subscription_events,
-- user_plan_assignments, plan_quotas, user_quota_overrides, quota_usage,
-- founding_pro_members) — no new entitlement system, no client-side
-- mutation path, no bypass of apply_subscription_event()/consume_quota().
-- Reproduces resolve_effective_quota_limit's exact
-- coalesce(override, plan_default) formula rather than recomputing it a
-- different way (0041_user_quota_overrides.sql).
--
-- Same is_platform_admin() re-check pattern as every other admin_* RPC.

create function public.admin_list_subscriptions(
  p_status text default null,
  p_plan_code text default null,
  p_limit int default 500
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  plan_code text,
  plan_name text,
  subscription_status text,
  billing_provider text,
  provider_subscription_id text,
  latest_order_reference text,
  latest_order_status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean,
  started_at timestamptz,
  last_event_at timestamptz,
  founding_pro_transition_status text
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
  with active_plan as (
    select upa.user_id, upa.plan_id, upa.starts_at
    from public.user_plan_assignments upa
    where upa.active = true
  ),
  latest_sub as (
    select distinct on (s.user_id) s.*
    from public.subscriptions s
    order by s.user_id, s.updated_at desc
  ),
  latest_order as (
    select distinct on (o.user_id) o.*
    from public.pesapal_checkout_orders o
    order by o.user_id, o.created_at desc
  )
  select
    pr.id,
    pr.email,
    pr.display_name,
    pl.code,
    pl.name,
    coalesce(ls.status, case when pl.code = 'free' then 'free' else 'none' end) as subscription_status,
    ls.provider,
    ls.provider_subscription_id,
    lo.merchant_reference,
    lo.status,
    ls.current_period_start,
    ls.current_period_end,
    ls.cancel_at_period_end,
    ap.starts_at,
    ls.last_event_at,
    fpm.transition_status
  from public.profiles pr
  join active_plan ap on ap.user_id = pr.id
  join public.plans pl on pl.id = ap.plan_id
  left join latest_sub ls on ls.user_id = pr.id
  left join latest_order lo on lo.user_id = pr.id
  left join public.founding_pro_members fpm on fpm.user_id = pr.id
  where (p_plan_code is null or pl.code = p_plan_code)
    and (p_status is null or coalesce(ls.status, case when pl.code = 'free' then 'free' else 'none' end) = p_status)
  order by ls.last_event_at desc nulls last, ap.starts_at desc
  limit greatest(p_limit, 0);
end;
$$;

revoke execute on function public.admin_list_subscriptions(text, text, int) from public;
revoke execute on function public.admin_list_subscriptions(text, text, int) from anon;
grant execute on function public.admin_list_subscriptions(text, text, int) to authenticated;

-- Surfaces subscription_events.processing_status ('failed'/'ignored_stale')
-- so admins can see billing inconsistencies without reading Supabase logs.
-- raw_payload is intentionally excluded — event_type + processing_status is
-- enough to triage from the admin UI without exposing the full Pesapal
-- webhook body.
create function public.admin_list_subscription_events(
  p_processing_status text default null,
  p_limit int default 200
)
returns table (
  id uuid,
  provider text,
  event_type text,
  processing_status text,
  received_at timestamptz,
  processed_at timestamptz,
  user_id uuid,
  email text,
  plan_code text
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
  select
    se.id, se.provider, se.event_type, se.processing_status, se.received_at, se.processed_at,
    s.user_id, pr.email, pl.code
  from public.subscription_events se
  left join public.subscriptions s on s.id = se.subscription_id
  left join public.profiles pr on pr.id = s.user_id
  left join public.plans pl on pl.id = s.plan_id
  where p_processing_status is null or se.processing_status = p_processing_status
  order by se.received_at desc
  limit greatest(p_limit, 0);
end;
$$;

revoke execute on function public.admin_list_subscription_events(text, int) from public;
revoke execute on function public.admin_list_subscription_events(text, int) from anon;
grant execute on function public.admin_list_subscription_events(text, int) to authenticated;

create function public.admin_commercial_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'active_subscriptions', (select count(*) from public.subscriptions where status = 'active'),
    'past_due_subscriptions', (select count(*) from public.subscriptions where status = 'past_due'),
    'cancelled_subscriptions', (select count(*) from public.subscriptions where status = 'cancelled'),
    'pending_checkout_orders', (select count(*) from public.pesapal_checkout_orders where status = 'pending'),
    'failed_checkout_orders_30d', (select count(*) from public.pesapal_checkout_orders where status = 'failed' and created_at > now() - interval '30 days'),
    'failed_subscription_events_30d', (select count(*) from public.subscription_events where processing_status = 'failed' and received_at > now() - interval '30 days'),
    'founding_pro_active', (select count(*) from public.founding_pro_members where transition_status = 'active'),
    'founding_pro_expiring_30d', (
      select count(*) from public.founding_pro_members
      where transition_status = 'active' and founding_expires_at is not null and founding_expires_at < now() + interval '30 days'
    ),
    'recent_transitions_30d', (
      select count(*) from public.founding_pro_events
      where event_type in ('converted_to_pro', 'expired_to_free') and created_at > now() - interval '30 days'
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_commercial_overview() from public;
revoke execute on function public.admin_commercial_overview() from anon;
grant execute on function public.admin_commercial_overview() to authenticated;

-- Per-user quota breakdown across every consumption-tracked quota_key on
-- their active plan (ai_messages + the six *_intelligence_operations
-- families) — excludes feature:* boolean entitlement flags, which are not
-- consumption quotas. effective_limit reproduces
-- resolve_effective_quota_limit's own coalesce(override, plan_default)
-- formula exactly (0041_user_quota_overrides.sql) rather than recomputing it
-- a different way.
create function public.admin_get_user_quota_breakdown(p_user_id uuid)
returns table (
  quota_key text,
  plan_limit bigint,
  override_limit bigint,
  effective_limit bigint,
  usage_count bigint,
  percent_used numeric,
  period_start timestamptz,
  period_end timestamptz
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
  select
    pq.quota_key,
    pq.quota_limit as plan_limit,
    uqo.quota_limit as override_limit,
    coalesce(uqo.quota_limit, pq.quota_limit) as effective_limit,
    coalesce(qu.usage_count, 0) as usage_count,
    case when coalesce(uqo.quota_limit, pq.quota_limit) > 0
      then round((coalesce(qu.usage_count, 0)::numeric / coalesce(uqo.quota_limit, pq.quota_limit)::numeric) * 100, 1)
      else 0
    end as percent_used,
    coalesce(qu.period_start, date_trunc('month', now())) as period_start,
    coalesce(qu.period_end, date_trunc('month', now()) + interval '1 month') as period_end
  from public.user_plan_assignments upa
  join public.plan_quotas pq on pq.plan_id = upa.plan_id
  left join public.user_quota_overrides uqo on uqo.user_id = upa.user_id and uqo.quota_key = pq.quota_key
  left join public.quota_usage qu on qu.user_id = upa.user_id and qu.quota_key = pq.quota_key
    and qu.period_start = date_trunc('month', now())
  where upa.user_id = p_user_id
    and upa.active = true
    and pq.quota_key not like 'feature:%'
  order by pq.quota_key;
end;
$$;

revoke execute on function public.admin_get_user_quota_breakdown(uuid) from public;
revoke execute on function public.admin_get_user_quota_breakdown(uuid) from anon;
grant execute on function public.admin_get_user_quota_breakdown(uuid) to authenticated;

-- Plan-level rollup for the Usage & Quotas page: configured quota + how many
-- users are on that plan. Consumption isn't summed per-plan here (that's a
-- per-user concern already covered by admin_get_user_quota_breakdown /
-- admin_list_users' ai_messages column) — this is deliberately just the
-- policy + population view P4.4 asks for at plan level.
create function public.admin_plan_quota_population()
returns table (
  plan_id uuid,
  plan_code text,
  plan_name text,
  quota_key text,
  quota_limit bigint,
  user_count bigint
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
  select
    pl.id, pl.code, pl.name, pq.quota_key, pq.quota_limit,
    (select count(*) from public.user_plan_assignments upa where upa.plan_id = pl.id and upa.active = true) as user_count
  from public.plans pl
  join public.plan_quotas pq on pq.plan_id = pl.id
  where pq.quota_key not like 'feature:%'
  order by pl.code, pq.quota_key;
end;
$$;

revoke execute on function public.admin_plan_quota_population() from public;
revoke execute on function public.admin_plan_quota_population() from anon;
grant execute on function public.admin_plan_quota_population() to authenticated;

-- Overview dashboard's usage/collaboration summary tiles — platform-wide
-- counts only (no per-user PII beyond a bounded top-N list of the most
-- exhausted quota rows, useful for the "unusual consumption" highlight).
create function public.admin_usage_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'exhausted_count', (
      select count(*) from public.quota_threshold_notifications
      where threshold = 100 and period_start = date_trunc('month', now())
    ),
    'over_90_count', (
      select count(distinct (user_id, quota_key)) from public.quota_threshold_notifications
      where threshold = 90 and period_start = date_trunc('month', now())
    ),
    'over_75_count', (
      select count(distinct (user_id, quota_key)) from public.quota_threshold_notifications
      where threshold = 75 and period_start = date_trunc('month', now())
    ),
    'active_collaborators', (select count(*) from public.workspace_members where status = 'active'),
    'pending_invitations', (select count(*) from public.workspace_invitations where status = 'pending'),
    'expired_pending_invitations', (
      select count(*) from public.workspace_invitations
      where status = 'pending' and expires_at is not null and expires_at < now()
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke execute on function public.admin_usage_overview() from public;
revoke execute on function public.admin_usage_overview() from anon;
grant execute on function public.admin_usage_overview() to authenticated;
