-- UX-14.5.8 Phase 1 — Invitation Foundation.
--
-- Closes the identity-lifecycle gap `ux-14.5.8-workspace-invitations-
-- discovery.md` found and reproduced live: `invite_to_workspace` (Phase 3,
-- 0030) could only ever invite someone who *already* has a `profiles` row,
-- and raised "No account found for that email" — a hard failure, and a
-- live-confirmed account-enumeration side channel — for the overwhelmingly
-- common real case of inviting a colleague who hasn't signed up yet.
--
-- This migration does three things, all additive:
--
-- 1. A new `workspace_invitations` table — separate from `workspace_members`
--    on purpose. `workspace_members.user_id` is `not null references
--    auth.users`, so there is no slot in that table for an identity that
--    doesn't exist yet; conflating "pending membership for a known user"
--    (workspace_members' own existing status='pending' rows, Phase 3,
--    unchanged by this migration) with "invitation to an unknown email"
--    would have meant loosening that not-null constraint for every existing
--    consumer of the table. A second table keeps both flows structurally
--    honest instead.
-- 2. `invite_to_workspace` gains a fallback branch: no matching `profiles`
--    row -> record a pending `workspace_invitations` row instead of
--    raising. Both branches now succeed identically from the caller's
--    perspective (closing the discovery's §8.1 enumeration finding as a
--    side effect of the redesign, not a separate patch), so the return
--    type changes from `workspace_members` (which the unknown-email branch
--    has no row of) to a small jsonb outcome descriptor. Email comparison
--    is now case-insensitive on both branches, closing the discovery's
--    second live-reproduced bug.
-- 3. `handle_new_user` (0001_init.sql) gains a reconciliation step: right
--    after creating the new user's `profiles` row, look for pending
--    `workspace_invitations` rows matching their (normalized) email and
--    promote each into a real, active `workspace_members` row — the exact
--    "signup reconciliation" the discovery's §10.2 recommended, reusing
--    the one mechanism this codebase already trusts for "react to a new
--    auth.users row," rather than inventing a cron/polling path.
--
-- No email sending in this migration (UX-14.5.8.3, deferred per the
-- discovery's own security-review recommendation — it's the first feature
-- that would need a service-role key). An invitee who signs up is
-- reconciled automatically; anyone else still has to be told out-of-band
-- to sign up, exactly as scoped.

-- 1. workspace_invitations

create type public.workspace_invitation_status as enum ('pending', 'accepted', 'cancelled');

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Always stored lower-cased (normalized once, at insert, by
  -- invite_to_workspace) so every later comparison — including
  -- handle_new_user's reconciliation lookup — is a plain equality check
  -- against an already-normalized value, not a repeated lower() call
  -- against unpredictable legacy casing the way `profiles.email` is.
  email text not null,
  role public.workspace_member_role not null,
  status public.workspace_invitation_status not null default 'pending',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 30 days is a reasonable default with no product decision recorded yet
  -- either way; not enforced anywhere in the UI this phase (no "expires in
  -- N days" display, no cancel-on-expiry job — both explicitly deferred to
  -- UX-14.5.8.2), only honored by handle_new_user's reconciliation query so
  -- a very old, forgotten invitation can't silently grant access years
  -- later.
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  -- Mirrors invite_to_workspace's own existing guard ("Ownership cannot be
  -- granted through an invitation") as a second, structural line of
  -- defense — matches this codebase's general preference for a
  -- constraint backing a business rule wherever cheap to add, not relying
  -- on application code being the only thing that ever enforces it.
  constraint workspace_invitations_role_not_owner check (role <> 'owner')
);

create index workspace_invitations_workspace_id_idx on public.workspace_invitations (workspace_id);
create index workspace_invitations_email_idx on public.workspace_invitations (email);

-- At most one *pending* invitation per (workspace, email) — re-inviting
-- while a pending invitation already exists should update it, not create
-- a duplicate; accepted/cancelled rows are historical and don't block a
-- fresh invitation to the same address later (mirrors workspace_members'
-- own "removed rows don't block re-invitation" precedent, Phase 3).
create unique index workspace_invitations_pending_unique
  on public.workspace_invitations (workspace_id, email)
  where status = 'pending';

create trigger set_workspace_invitations_updated_at
  before update on public.workspace_invitations
  for each row execute function public.set_updated_at();

alter table public.workspace_invitations enable row level security;

-- Read-only for any workspace member (viewer-or-above) — the row already
-- carries the invitee's email directly, so unlike `workspace_members`
-- (whose roster needs the security-definer `list_workspace_members` RPC to
-- bridge `profiles`' self-only RLS), a plain RLS SELECT policy is
-- sufficient here; there's no cross-user join to resolve. No client-side
-- INSERT/UPDATE/DELETE policy at all this phase, matching
-- `workspace_members`' own posture toward `invite_to_workspace`: the only
-- writers are this migration's security-definer functions
-- (invite_to_workspace, handle_new_user), which bypass RLS entirely by
-- running as security definer, so an absent policy is the correct,
-- tightest posture rather than a gap — cancel/role-change (UX-14.5.8.2)
-- will add their own narrow, owner-gated UPDATE policy when built.
create policy "Workspace members can view pending invitations"
  on public.workspace_invitations for select
  using (public.has_workspace_role(workspace_id, 'viewer'));

-- 2. invite_to_workspace — return type changes (workspace_members row ->
-- jsonb outcome descriptor), so this must be dropped and recreated rather
-- than `create or replace`d (Postgres rejects an in-place return-type
-- change). Existing callers are unaffected: `inviteToWorkspace()`
-- (workspaceMembers.ts) already only checks `error`, never inspects the
-- resolved row's shape.

drop function if exists public.invite_to_workspace(uuid, text, public.workspace_member_role);

create function public.invite_to_workspace(
  target_workspace_id uuid,
  invitee_email text,
  invitee_role public.workspace_member_role
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(invitee_email));
  invitee_id uuid;
  result_row public.workspace_members;
  invitation_row public.workspace_invitations;
begin
  if not public.has_workspace_role(target_workspace_id, 'owner') then
    raise exception 'Only a workspace owner can invite members';
  end if;

  if invitee_role = 'owner' then
    raise exception 'Ownership cannot be granted through an invitation';
  end if;

  select id into invitee_id from public.profiles where lower(email) = v_email;

  if invitee_id is not null then
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

    return jsonb_build_object('outcome', 'member_invited', 'membership_id', result_row.id);
  end if;

  -- No account yet: record the invitation by email instead of failing.
  -- handle_new_user resolves it automatically once they sign up.
  insert into public.workspace_invitations (workspace_id, email, role, invited_by)
  values (target_workspace_id, v_email, invitee_role, auth.uid())
  on conflict (workspace_id, email) where status = 'pending' do update
    set role = excluded.role,
        invited_by = excluded.invited_by,
        expires_at = now() + interval '30 days',
        updated_at = now()
  returning * into invitation_row;

  return jsonb_build_object('outcome', 'invitation_created', 'invitation_id', invitation_row.id);
end;
$$;

-- 3. handle_new_user — reconciliation. Same function, same trigger, one
-- additive step after the existing profile-creation insert. Every pending
-- invitation matching the new user's (lower-cased) email is promoted to a
-- real, active membership, then marked accepted — an invitee who was
-- invited to three workspaces before signing up gets all three the moment
-- they finish signup, with no separate "accept" click required (there's
-- nothing to ambiguously accept-or-decline the way an existing user's
-- workspace_members pending row is — they only learned about the
-- workspace by being invited, so signing up IS the acceptance).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(new.email);
  invitation record;
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  for invitation in
    select * from public.workspace_invitations
    where email = v_email
      and status = 'pending'
      and expires_at > now()
  loop
    insert into public.workspace_members (workspace_id, user_id, role, status, invited_by)
    values (invitation.workspace_id, new.id, invitation.role, 'active', invitation.invited_by)
    on conflict (workspace_id, user_id) do nothing;

    update public.workspace_invitations
    set status = 'accepted', accepted_at = now(), accepted_by = new.id
    where id = invitation.id;
  end loop;

  return new;
end;
$$;
