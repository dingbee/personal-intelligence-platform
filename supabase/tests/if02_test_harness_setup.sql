-- Minimal isolated PostgreSQL fixture for IF-02 RPC certification.
-- This fixture is disposable and must never be pointed at a production database.
create extension if not exists pgcrypto;
create role anon nologin;
create role authenticated nologin;
create schema if not exists auth;

create table auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select ((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid)
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer', 'editor', 'owner')),
  status text not null check (status in ('active', 'pending', 'removed')),
  primary key (workspace_id, user_id)
);

create or replace function public.has_workspace_role(p_workspace_id uuid, p_min_role text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
      and case wm.role when 'viewer' then 1 when 'editor' then 2 when 'owner' then 3 else 0 end
          >= case p_min_role when 'viewer' then 1 when 'editor' then 2 when 'owner' then 3 else 99 end
  );
$$;

create table public.workspace_objectives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  status text not null default 'active'
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  title text not null default 'New conversation'
);

create table public.execution_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
);

create table public.plan_quotas (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  quota_key text not null,
  quota_limit bigint not null,
  quota_period text not null,
  unique (plan_id, quota_key)
);

create table public.user_plan_assignments (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  active boolean not null default true,
  primary key (user_id, plan_id)
);

create or replace function public.has_feature(p_user_id uuid, p_feature_key text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_plan_assignments upa
    join public.plan_quotas pq on pq.plan_id = upa.plan_id
    where upa.user_id = p_user_id
      and upa.active
      and pq.quota_key = 'feature:' || p_feature_key
      and pq.quota_limit > 0
  );
$$;

insert into auth.users(id) values
  ('23c725ec-b2d6-487c-8291-dae7a280a291'),
  ('313866d5-4ab7-4d65-bda9-67b9bd668f2d');

insert into public.plans(code) values ('pro'), ('founding_pro'), ('free');
insert into public.user_plan_assignments(user_id, plan_id)
select '23c725ec-b2d6-487c-8291-dae7a280a291', id from public.plans where code = 'pro';
insert into public.user_plan_assignments(user_id, plan_id)
select '313866d5-4ab7-4d65-bda9-67b9bd668f2d', id from public.plans where code = 'free';
