-- UX-14.5 Phase 3: Workspace Sharing (invitations + member management).
-- Reuses the Phase 1 primitives (0028_workspace_members.sql) exactly as
-- designed there — no new table, no new role/status vocabulary, no
-- generic permissions framework. Two gaps found while building the
-- member-management surface on top of Phase 1/2, both fixed here:
--
-- 1. `workspaces`' own RLS was never extended past `auth.uid() = user_id`
--    (Phase 1 deliberately deferred this — see that migration's header).
--    That means a member added via workspace_members still couldn't see
--    the workspace itself: listWorkspaces() (workspaces.ts) already
--    defers entirely to RLS with no explicit user_id filter, exactly
--    like notes.ts did before Phase 2, so this is the same shape of fix.
-- 2. There was no way for an owner to turn "invite bob@example.com" into
--    a user_id: `profiles` RLS is self-only, by design, so a plain
--    client-side lookup is correctly blocked. A security-definer RPC
--    (matching the has_workspace_role/create_workspace_owner_membership
--    pattern already established) is the minimal primitive that closes
--    this without loosening profiles' own RLS for everyone.

-- 1. workspaces: split the single ALL policy into per-command policies.
-- insert stays creator-only (self-attributed, unchanged). update/delete
-- stay owner-only, but "owner" now means the resolved workspace owner
-- (creator OR an explicit workspace_members owner row), not just the
-- row's own user_id — matching notes' delete policy from Phase 2.
-- select gains two additions: any member (viewer-or-above) can see a
-- workspace they belong to, and a *pending* invitee can see the
-- workspace's basic info (needed to render "you've been invited to
-- X") even though a pending row doesn't yet satisfy has_workspace_role
-- (which only counts status = 'active' rows, by design).

drop policy "Users manage their own workspaces" on public.workspaces;

create policy "Workspace owners and members can view their workspaces"
  on public.workspaces for select
  using (
    auth.uid() = user_id
    or public.has_workspace_role(id, 'viewer')
    or exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = workspaces.id
        and workspace_members.user_id = auth.uid()
        and workspace_members.status = 'pending'
    )
  );

create policy "Workspace creators can create workspaces"
  on public.workspaces for insert
  with check (auth.uid() = user_id);

create policy "Workspace owners can update their workspaces"
  on public.workspaces for update
  using (auth.uid() = user_id or public.has_workspace_role(id, 'owner'))
  with check (auth.uid() = user_id or public.has_workspace_role(id, 'owner'));

create policy "Workspace owners can delete their workspaces"
  on public.workspaces for delete
  using (auth.uid() = user_id or public.has_workspace_role(id, 'owner'));

-- 2. invite_to_workspace: the one write path for creating an invitation.
-- Ownership can't be granted through it (invitee_role is restricted to
-- editor/viewer) — ownership transfer is out of scope for this phase,
-- so there is deliberately no path to a second simultaneous owner (the
-- partial unique index from Phase 1 would reject one anyway). Upserts
-- rather than plain-inserts so re-inviting someone who previously
-- declined or was removed works instead of hitting the
-- (workspace_id, user_id) unique constraint; the `where` guard on the
-- conflict update makes re-inviting a *currently active* member a no-op
-- (surfaced as an error) rather than silently changing their role.
create function public.invite_to_workspace(
  target_workspace_id uuid,
  invitee_email text,
  invitee_role public.workspace_member_role
)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  invitee_id uuid;
  result_row public.workspace_members;
begin
  if not public.has_workspace_role(target_workspace_id, 'owner') then
    raise exception 'Only a workspace owner can invite members';
  end if;

  if invitee_role = 'owner' then
    raise exception 'Ownership cannot be granted through an invitation';
  end if;

  select id into invitee_id from public.profiles where email = invitee_email;
  if invitee_id is null then
    raise exception 'No account found for that email';
  end if;

  if invitee_id = auth.uid() then
    raise exception 'You are already the owner of this workspace';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status, invited_by)
  values (target_workspace_id, invitee_id, invitee_role, 'pending', auth.uid())
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        status = 'pending',
        invited_by = excluded.invited_by,
        updated_at = now()
    where public.workspace_members.status <> 'active'
  returning * into result_row;

  if result_row.id is null then
    raise exception 'That person is already a member of this workspace';
  end if;

  return result_row;
end;
$$;

-- 3. respond_to_workspace_invitation: the one write path an invitee (not
-- yet a member — has_workspace_role excludes 'pending' rows by design)
-- uses to accept or decline their own invitation. Deliberately narrow:
-- only ever touches `status` (accept) or removes the row entirely
-- (decline) for a row that is (a) the caller's own and (b) currently
-- pending — never touches `role`, so there is no privilege-escalation
-- surface through this function.
create function public.respond_to_workspace_invitation(
  target_membership_id uuid,
  accept boolean
)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  result_row public.workspace_members;
begin
  if accept then
    update public.workspace_members
    set status = 'active'
    where id = target_membership_id and user_id = auth.uid() and status = 'pending'
    returning * into result_row;
  else
    delete from public.workspace_members
    where id = target_membership_id and user_id = auth.uid() and status = 'pending'
    returning * into result_row;
  end if;

  if result_row.id is null then
    raise exception 'Invitation not found or already responded to';
  end if;

  return result_row;
end;
$$;

-- 4. list_workspace_members: the one read path for the member-management
-- UI. workspace_members' own SELECT RLS (Phase 1) already lets any
-- member read the raw roster, but rendering it needs each member's
-- email/display name, and `profiles` RLS is intentionally self-only —
-- this security-definer function is what bridges that gap without
-- loosening profiles' own policy for everyone. Re-checks membership
-- explicitly (the same two-tier check has_workspace_role itself uses)
-- since running as security definer bypasses workspace_members' RLS.
-- Also synthesizes the implicit owner as a row when a workspace has no
-- explicit workspace_members entry for its creator — every workspace
-- created before 0028's trigger existed — so backward compatibility
-- (deliverable requirement) holds: a pre-Phase-1 single-user workspace
-- still shows its (one, implicit) owner instead of an empty roster.
create function public.list_workspace_members(target_workspace_id uuid)
returns table (
  id uuid,
  workspace_id uuid,
  user_id uuid,
  role public.workspace_member_role,
  status public.workspace_member_status,
  invited_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  email text,
  display_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (
    exists (select 1 from public.workspaces where workspaces.id = target_workspace_id and workspaces.user_id = auth.uid())
    or public.has_workspace_role(target_workspace_id, 'viewer')
  ) then
    raise exception 'Not a member of this workspace';
  end if;

  return query
    select rows.id, rows.workspace_id, rows.user_id, rows.role, rows.status, rows.invited_by,
           rows.created_at, rows.updated_at, rows.email, rows.display_name
    from (
      select m.id, m.workspace_id, m.user_id, m.role, m.status, m.invited_by, m.created_at, m.updated_at,
             p.email, p.display_name
      from public.workspace_members m
      join public.profiles p on p.id = m.user_id
      where m.workspace_id = target_workspace_id

      union all

      select null::uuid, w.id, w.user_id, 'owner'::public.workspace_member_role, 'active'::public.workspace_member_status,
             null::uuid, w.created_at, w.created_at, p.email, p.display_name
      from public.workspaces w
      join public.profiles p on p.id = w.user_id
      where w.id = target_workspace_id
        and not exists (
          select 1 from public.workspace_members m2 where m2.workspace_id = w.id and m2.user_id = w.user_id
        )
    ) rows
    order by rows.created_at asc;
end;
$$;
