-- Beta / Admin / AI Governance Foundation — Phase 6/7 groundwork.
--
-- Platform-level authorization primitive. Deliberately NOT a `profiles`
-- column: `profiles` already has a self-service RLS UPDATE policy
-- (`auth.uid() = id`), so an `is_admin` boolean there would let any user
-- grant themselves admin by editing their own profile — a direct
-- violation of "founder privileges cannot be self-assigned." A separate
-- table with zero client write policies closes that off entirely:
-- granting admin status is only ever a manual, explicit, out-of-band SQL
-- statement (as below), never a client-reachable mutation.
--
-- Mirrors has_workspace_role()'s existing shape exactly (0028_workspace_
-- members.sql) — the one precedent in this codebase for "the client and
-- the database must agree on who's allowed to do what."

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id)
);

alter table public.platform_admins enable row level security;

-- A user can check whether *they* are an admin; the full admin roster
-- isn't exposed to arbitrary authenticated clients. No insert/update/
-- delete policy at all, for any role — see header comment above.
create policy "Users can check their own admin status"
  on public.platform_admins for select
  to authenticated
  using (auth.uid() = user_id);

create function public.is_platform_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = uid);
$$;

revoke execute on function public.is_platform_admin(uuid) from public;
grant execute on function public.is_platform_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Admin data-access RPCs. All SECURITY DEFINER, all re-check
-- is_platform_admin() internally and raise if the caller isn't one —
-- this is what makes the authorization server-enforced rather than
-- merely UI-hidden. `profiles`/`beta_invites` RLS is self-only/locked
-- down for ordinary clients (by design); these functions bridge that
-- for an admin caller the same way list_workspace_members() already
-- bridges workspace_members' RLS for a workspace viewer.
-- ---------------------------------------------------------------------

create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  plan_code text,
  plan_name text,
  quota_used bigint,
  quota_limit bigint,
  beta_status text
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
      qu.usage_count,
      pq.quota_limit,
      bi.status
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join public.user_plan_assignments upa on upa.user_id = p.id and upa.active = true
    left join public.plans pl on pl.id = upa.plan_id
    left join public.plan_quotas pq on pq.plan_id = pl.id and pq.quota_key = 'ai_messages'
    left join public.quota_usage qu
      on qu.user_id = p.id and qu.quota_key = 'ai_messages' and qu.period_start = date_trunc('month', now())
    left join public.beta_invites bi on lower(bi.email) = lower(p.email)
    order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

create function public.admin_list_beta_invites()
returns table (
  id uuid,
  email text,
  status text,
  full_name text,
  organization text,
  invited_by text,
  created_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid,
  accepted_by_email text,
  plan_id uuid,
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
      bi.id, bi.email, bi.status, bi.full_name, bi.organization, bi.invited_by,
      bi.created_at, bi.accepted_at, bi.accepted_by, p.email, bi.plan_id, pl.code
    from public.beta_invites bi
    left join public.profiles p on p.id = bi.accepted_by
    left join public.plans pl on pl.id = bi.plan_id
    order by bi.created_at desc;
end;
$$;

revoke execute on function public.admin_list_beta_invites() from public;
grant execute on function public.admin_list_beta_invites() to authenticated;

-- Returns a typed outcome ('created'|'duplicate') rather than letting a
-- duplicate email surface as a raw unique-constraint-violation error —
-- the existing UNIQUE(lower(email)) index (0034) is what actually
-- prevents the duplicate; this just checks it first for a clean result.
create function public.admin_create_beta_invite(
  p_email text,
  p_full_name text default null,
  p_organization text default null,
  p_plan_id uuid default null
)
returns table (outcome text, invite_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_founder_email text;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if exists (select 1 from public.beta_invites where lower(email) = lower(p_email)) then
    return query select 'duplicate'::text, null::uuid;
    return;
  end if;

  select email into v_founder_email from public.profiles where id = auth.uid();

  insert into public.beta_invites (email, full_name, organization, plan_id, invited_by)
  values (lower(p_email), p_full_name, p_organization, p_plan_id, v_founder_email)
  returning id into v_id;

  return query select 'created'::text, v_id;
end;
$$;

revoke execute on function public.admin_create_beta_invite(text, text, text, uuid) from public;
grant execute on function public.admin_create_beta_invite(text, text, text, uuid) to authenticated;

-- Only ever deletes a still-pending invite — an already-accepted row
-- (real signup history) is never touched, per "preserve existing invite
-- data."
create function public.admin_revoke_beta_invite(p_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  delete from public.beta_invites where id = p_invite_id and status = 'invited';
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke execute on function public.admin_revoke_beta_invite(uuid) from public;
grant execute on function public.admin_revoke_beta_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Bootstrap the one known operator account as founder. This is the only
-- data this migration writes to an existing table, and it's exactly one
-- row: dan@nolmark.co (user_id 23c725ec-b2d6-487c-8291-dae7a280a291,
-- the account that accepted the sole existing beta_invites row and is
-- this project's operator) becomes the first platform admin. There is
-- deliberately no self-service bootstrap path — this manual insert *is*
-- the bootstrap, consistent with "founder privileges cannot be
-- self-assigned."
-- ---------------------------------------------------------------------

insert into public.platform_admins (user_id, granted_by)
values ('23c725ec-b2d6-487c-8291-dae7a280a291', '23c725ec-b2d6-487c-8291-dae7a280a291')
on conflict (user_id) do nothing;
