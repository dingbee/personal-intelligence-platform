-- UX-14.5 Phase 1: Identity Foundation. Builds exactly the primitive the
-- UX-14.5 discovery sequence (docs/ux-14.5*.md) designed: a membership
-- table plus a security-definer role-check helper for future RLS
-- policies to consume — nothing else. No existing table's RLS is
-- touched by this migration; per docs/ux-14.5.3's finding, which tables
-- extend with a workspace-membership OR-clause and which stay
-- permanently excluded (ai_memory, ai_requests, provider_overrides,
-- reading_progress) is a decision for each of those tables' own future
-- migration, not this one.
--
-- This migration is additive-only and changes zero existing behavior
-- for any current account: a workspace with no workspace_members rows
-- (every workspace that exists today) keeps resolving to exactly its
-- current single-owner behavior, because both resolveWorkspaceRole
-- (TypeScript) and has_workspace_role (SQL, below) fall back to
-- workspaces.user_id as the implicit owner when no explicit membership
-- row exists (docs/ux-14.5.2 §2.2, §2.4). No backfill of existing
-- workspaces is performed, matching that document's explicit
-- recommendation.

create type public.workspace_member_role as enum ('owner', 'editor', 'viewer');
create type public.workspace_member_status as enum ('active', 'pending', 'removed');

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_member_role not null,
  status public.workspace_member_status not null default 'active',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One membership per user/workspace pair.
  unique (workspace_id, user_id)
);

create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- At most one active owner per workspace. "An owner must exist" (at
-- least one) can't be expressed as a table constraint on rows that
-- don't exist yet — that half of the requirement is guaranteed instead
-- by the trigger below, for every workspace created from this
-- migration forward. Pre-existing workspaces have zero workspace_members
-- rows and are not backfilled (see the header comment); their owner
-- stays implicit via workspaces.user_id, exactly as
-- resolveWorkspaceRole/has_workspace_role both read it.
create unique index workspace_members_one_active_owner_idx
  on public.workspace_members (workspace_id)
  where role = 'owner' and status = 'active';

create trigger set_workspace_members_updated_at
  before update on public.workspace_members
  for each row execute function public.set_updated_at();

-- Auto-provision the creator's explicit owner membership row for every
-- new workspace, so "an owner must exist" holds by construction going
-- forward. Mirrors handle_new_user's auth.users -> profiles
-- auto-provisioning trigger (0001_init.sql) exactly, including running
-- as security definer so it isn't blocked by workspace_members' own
-- insert policy below.
create function public.create_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (new.id, new.user_id, 'owner', 'active');
  return new;
end;
$$;

create trigger on_workspace_created_add_owner
  after insert on public.workspaces
  for each row execute function public.create_workspace_owner_membership();

alter table public.workspace_members enable row level security;

-- has_workspace_role: the one reusable role-check primitive every
-- future RLS policy (on notes, documents, etc. — none of them touched
-- by this migration) will call, per docs/ux-14.5.2 §4.2. security
-- definer so it can read workspace_members/workspaces on the caller's
-- behalf without those reads themselves being subject to (and
-- recursing into) this table's own RLS. Implements the exact same
-- two-tier logic as the TypeScript resolveWorkspaceRole: an explicit
-- active membership row first, falling back to workspaces.user_id as
-- the implicit owner. Role ordering is owner > editor > viewer;
-- minimum_role is satisfied by that role or any higher one.
create function public.has_workspace_role(
  target_workspace_id uuid,
  minimum_role public.workspace_member_role
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_role public.workspace_member_role;
begin
  select role into resolved_role
  from public.workspace_members
  where workspace_id = target_workspace_id
    and user_id = auth.uid()
    and status = 'active';

  if resolved_role is null then
    if exists (
      select 1 from public.workspaces
      where id = target_workspace_id and user_id = auth.uid()
    ) then
      resolved_role := 'owner';
    end if;
  end if;

  if resolved_role is null then
    return false;
  end if;

  return (
    case resolved_role when 'owner' then 3 when 'editor' then 2 when 'viewer' then 1 end
  ) >= (
    case minimum_role when 'owner' then 3 when 'editor' then 2 when 'viewer' then 1 end
  );
end;
$$;

-- workspace_members' own RLS is the first real consumer of the helper
-- above, proving it end-to-end before any other table adopts it. A
-- member can see their own row and every row in a workspace they
-- belong to (the roster); only an owner can add, change, or remove
-- membership.
create policy "Members can view workspace membership"
  on public.workspace_members for select
  using (
    user_id = auth.uid()
    or public.has_workspace_role(workspace_id, 'viewer')
  );

create policy "Owners add workspace membership"
  on public.workspace_members for insert
  with check (public.has_workspace_role(workspace_id, 'owner'));

create policy "Owners update workspace membership"
  on public.workspace_members for update
  using (public.has_workspace_role(workspace_id, 'owner'))
  with check (public.has_workspace_role(workspace_id, 'owner'));

create policy "Owners remove workspace membership"
  on public.workspace_members for delete
  using (public.has_workspace_role(workspace_id, 'owner'));
