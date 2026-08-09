-- ARRIYIA Quota Administration Remediation.
--
-- Incident: the founder tried to adjust one beta user's quota and
-- perceived it as affecting the whole user list. Root cause (confirmed by
-- read-only forensic audit, no data was actually mass-modified): this
-- schema has never had a per-user quota override. plan_quotas defines a
-- limit shared by every user on a plan; the only way to give one user a
-- different limit was to edit the plan itself, which — since all current
-- beta users share the same Beta plan — changes everyone's number at
-- once. admin_reset_user_quota (resets usage, not the limit) was and
-- remains correctly scoped to exactly one user; it was never capable of
-- a mass update. This migration closes the actual gap: a genuine,
-- per-user, per-quota-key override that a plan-wide edit can never touch.
--
-- Additive only. No existing table is altered, no existing row is
-- touched, no existing RPC's data-affecting behavior changes (consume_quota
-- is rewritten to call a shared resolver instead of inlining the plan
-- lookup, but produces the identical effective limit for every user with
-- no override today, since none exist yet).

-- ---------------------------------------------------------------------
-- user_quota_overrides — one optional row per (user, quota_key). Absence
-- means "use the plan default." Mirrors quota_usage's shape/RLS/grant
-- discipline exactly (0034_beta_invite_quota_repair.sql): the user may
-- read their own row; every write goes through a SECURITY DEFINER RPC
-- below, matching this project's established "no client write policy on
-- admin-controlled tables" convention (plan_quotas, quota_usage, both
-- already following it).
-- ---------------------------------------------------------------------

create table public.user_quota_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quota_key text not null,
  quota_limit bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  constraint user_quota_overrides_limit_non_negative check (quota_limit >= 0),
  constraint user_quota_overrides_user_quota_key_unique unique (user_id, quota_key)
);

alter table public.user_quota_overrides enable row level security;

create policy "Users can view their own quota override"
  on public.user_quota_overrides for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- resolve_effective_quota_limit — the one authoritative place that
-- computes effective_limit = coalesce(personal override, plan default).
-- Both consume_quota (below) and the client's quotaService.checkQuota
-- call this instead of re-deriving the same formula inline, so there is
-- exactly one place this logic can ever drift. Callable by a user for
-- their own id, or by a platform admin for any id — auth.uid() is read
-- from the caller's JWT claims and is unaffected by SECURITY DEFINER's
-- role elevation, so this check holds correctly even when called from
-- inside another SECURITY DEFINER function (admin_list_users below).
-- ---------------------------------------------------------------------

create or replace function public.resolve_effective_quota_limit(p_user_id uuid, p_quota_key text)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_plan_limit bigint;
  v_override bigint;
begin
  if auth.uid() is distinct from p_user_id and not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select upa.plan_id into v_plan_id
  from public.user_plan_assignments upa
  where upa.user_id = p_user_id and upa.active = true
  limit 1;

  if v_plan_id is null then
    return null;
  end if;

  select pq.quota_limit into v_plan_limit
  from public.plan_quotas pq
  where pq.plan_id = v_plan_id and pq.quota_key = p_quota_key;

  select uqo.quota_limit into v_override
  from public.user_quota_overrides uqo
  where uqo.user_id = p_user_id and uqo.quota_key = p_quota_key;

  return coalesce(v_override, v_plan_limit);
end;
$$;

revoke execute on function public.resolve_effective_quota_limit(uuid, text) from public;
revoke execute on function public.resolve_effective_quota_limit(uuid, text) from anon;
grant execute on function public.resolve_effective_quota_limit(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- consume_quota rewritten to resolve its limit through the shared
-- resolver instead of inlining its own plan_id/plan_quotas lookup.
-- Consumption semantics (atomic upsert-increment, current-period scoping,
-- auth.uid()-resolved caller) are byte-for-byte unchanged from
-- 0034_beta_invite_quota_repair.sql — only where the limit number comes
-- from has changed, and for every user with no override (all of them,
-- today) the returned limit is identical to before this migration.
-- ---------------------------------------------------------------------

create or replace function public.consume_quota(p_quota_key text)
returns table (usage_count bigint, quota_limit bigint, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit bigint;
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end timestamptz := date_trunc('month', now()) + interval '1 month';
  v_count bigint;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_limit := public.resolve_effective_quota_limit(v_user_id, p_quota_key);

  if v_limit is null then
    return query select 0::bigint, 0::bigint, false;
    return;
  end if;

  insert into public.quota_usage (user_id, quota_key, usage_count, period_start, period_end)
  values (v_user_id, p_quota_key, 1, v_period_start, v_period_end)
  on conflict (user_id, quota_key, period_start)
  do update set usage_count = quota_usage.usage_count + 1, updated_at = now()
  returning quota_usage.usage_count into v_count;

  return query select v_count, v_limit, (v_count <= v_limit);
end;
$$;

revoke execute on function public.consume_quota(text) from public;
revoke execute on function public.consume_quota(text) from anon;
grant execute on function public.consume_quota(text) to authenticated;

-- ---------------------------------------------------------------------
-- admin_set_user_quota_override / admin_remove_user_quota_override —
-- the two new admin write paths. Each affects exactly one
-- (user_id, quota_key) row and never touches plan_quotas or another
-- user's row — mirrors admin_reset_user_quota's own scoping discipline
-- (0036_founder_command_center.sql) exactly.
-- ---------------------------------------------------------------------

create or replace function public.admin_set_user_quota_override(p_user_id uuid, p_quota_key text, p_quota_limit bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if p_quota_limit < 0 then
    raise exception 'Quota limit cannot be negative';
  end if;

  insert into public.user_quota_overrides (user_id, quota_key, quota_limit, updated_by, updated_at)
  values (p_user_id, p_quota_key, p_quota_limit, auth.uid(), now())
  on conflict (user_id, quota_key)
  do update set quota_limit = p_quota_limit, updated_by = auth.uid(), updated_at = now();
end;
$$;

revoke execute on function public.admin_set_user_quota_override(uuid, text, bigint) from public;
revoke execute on function public.admin_set_user_quota_override(uuid, text, bigint) from anon;
grant execute on function public.admin_set_user_quota_override(uuid, text, bigint) to authenticated;

create or replace function public.admin_remove_user_quota_override(p_user_id uuid, p_quota_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  delete from public.user_quota_overrides
  where user_id = p_user_id and quota_key = p_quota_key;
end;
$$;

revoke execute on function public.admin_remove_user_quota_override(uuid, text) from public;
revoke execute on function public.admin_remove_user_quota_override(uuid, text) from anon;
grant execute on function public.admin_remove_user_quota_override(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- admin_list_users extended with plan_quota_limit / quota_override /
-- effective_quota_limit so the Users page can render the full per-user
-- quota picture in one call, same "one round trip" shape it already had.
-- New OUT columns require drop+recreate (Postgres can't change a
-- function's return type via create or replace), same as
-- 0036_founder_command_center.sql's own precedent for this exact
-- function. quota_used/beta_status/is_disabled/etc. are unchanged.
-- ---------------------------------------------------------------------

drop function public.admin_list_users();

create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  plan_code text,
  plan_name text,
  plan_quota_limit bigint,
  quota_override bigint,
  effective_quota_limit bigint,
  quota_used bigint,
  beta_status text,
  is_disabled boolean
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
      p.id,
      p.email,
      p.display_name,
      p.created_at,
      u.last_sign_in_at,
      pl.code,
      pl.name,
      pq.quota_limit,
      uqo.quota_limit,
      coalesce(uqo.quota_limit, pq.quota_limit),
      qu.usage_count,
      bi.status,
      (u.banned_until is not null and u.banned_until > now())
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join public.user_plan_assignments upa on upa.user_id = p.id and upa.active = true
    left join public.plans pl on pl.id = upa.plan_id
    left join public.plan_quotas pq on pq.plan_id = pl.id and pq.quota_key = 'ai_messages'
    left join public.user_quota_overrides uqo on uqo.user_id = p.id and uqo.quota_key = 'ai_messages'
    left join public.quota_usage qu
      on qu.user_id = p.id and qu.quota_key = 'ai_messages' and qu.period_start = date_trunc('month', now())
    left join public.beta_invites bi on lower(bi.email) = lower(p.email)
    order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_list_users() from public;
revoke execute on function public.admin_list_users() from anon;
grant execute on function public.admin_list_users() to authenticated;
