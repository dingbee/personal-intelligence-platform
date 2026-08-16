-- Notification Foundation & Background Intelligence Phase 1.
--
-- Closes the confirmed gap: a Collaboration invitation reaches ARRIYIA and
-- persists (workspace_members status='pending', 0030/0046), but nothing
-- generates an ambient in-app signal for the recipient — the bell
-- (TopBar.tsx) has been a decorative, disabled button. Email delivery is a
-- separate, already-known operational issue (missing RESEND_API_KEY) and is
-- untouched here: this migration and the client code built on it must work
-- identically whether or not email succeeds.
--
-- This is Phase 1 of Background Intelligence, not the full system. `type`
-- is a free-form string and `payload` is jsonb specifically so future
-- notification producers (workspace events, AI-generated insights,
-- scheduled digests, system notices) can reuse this same table without a
-- schema rewrite per event type — but no such producer is built here; the
-- only writer this migration adds is the Collaboration invitation path.

-- 1. notifications
--
-- `read_at timestamptz | null` is the sole unread model (null = unread) —
-- deliberately no separate `is_read` boolean, so there's only one thing to
-- keep in sync. Append-only-by-construction, mirroring `ai_requests`'
-- (0006) and `workspace_invitations`' (0032) precedent: RLS grants SELECT
-- of a user's own rows only, and there is no client-facing INSERT/UPDATE/
-- DELETE policy at all — every write goes through a SECURITY DEFINER
-- function (this migration's own `mark_notification_read`/
-- `mark_all_notifications_read`, and `invite_to_workspace` below), so an
-- absent policy is the intended tightest posture, not a gap.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  -- e.g. 'collaboration_invitation'. Free-form on purpose — new producers
  -- register a new type value, not a new column or table.
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Backs the bell's own query: a recipient's notifications newest-first.
create index notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Users view their own notifications"
  on public.notifications for select
  using (auth.uid() = recipient_user_id);

-- 2. mark_notification_read / mark_all_notifications_read
--
-- SECURITY DEFINER so the write can happen despite no client UPDATE
-- policy, but each still re-checks recipient_user_id = auth.uid() itself
-- (bypassing RLS is not the same as skipping authorization) — matches
-- this codebase's existing SECURITY DEFINER convention (e.g.
-- `respond_to_workspace_invitation`, 0030) of re-validating ownership
-- inside the function body rather than trusting the caller.

create function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where id = p_notification_id
    and recipient_user_id = auth.uid()
    and read_at is null;
end;
$$;

create function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where recipient_user_id = auth.uid()
    and read_at is null;
end;
$$;

-- 3. invite_to_workspace — re-declared with CREATE OR REPLACE, preserving
-- every existing line of logic verbatim from 0046 (ownership check,
-- collaboration entitlement gate, invite target resolution, pending-
-- membership upsert, email-based invitation fallback), adding exactly two
-- things:
--
--   a. `v_already_pending`, computed *before* the upsert, so a resend of
--      an invitation that is already sitting in status='pending' for this
--      (workspace, user) pair does not create a second notification — the
--      recipient already has one unread invitation notification; resending
--      doesn't create a materially new event for them. A first-time invite,
--      or a re-invite after the person was previously removed/declined
--      (status <> 'pending' beforehand), does notify — from the recipient's
--      perspective those genuinely are new.
--   b. a notification insert, scoped only to the existing-user branch
--      (workspace_members), never the unknown-email branch
--      (workspace_invitations) — an unknown email has no `recipient_user_id`
--      to notify; they're reconciled into membership at signup instead
--      (handle_new_user, 0032), same as before this migration.
--
-- Runs inside the same function/transaction as the membership write, so
-- "never notify on a failed invitation" falls out of ordinary Postgres
-- transactional atomicity — no separate trigger or dual-write to keep in
-- sync.

create or replace function public.invite_to_workspace(target_workspace_id uuid, invitee_email text, invitee_role workspace_member_role)
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
  v_already_pending boolean;
  v_workspace_name text;
  v_inviter_name text;
begin
  if not public.has_workspace_role(target_workspace_id, 'owner') then
    raise exception 'Only a workspace owner can invite members';
  end if;

  if not public.has_feature(auth.uid(), 'collaboration') then
    raise exception 'Collaboration requires a Pro plan'
      using errcode = 'P0001';
  end if;

  if invitee_role = 'owner' then
    raise exception 'Ownership cannot be granted through an invitation';
  end if;

  select id into invitee_id from public.profiles where lower(email) = v_email;

  if invitee_id is not null then
    if invitee_id = auth.uid() then
      raise exception 'You are already the owner of this workspace';
    end if;

    select exists(
      select 1 from public.workspace_members
      where workspace_id = target_workspace_id
        and user_id = invitee_id
        and status = 'pending'
    ) into v_already_pending;

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

    if not v_already_pending then
      select name into v_workspace_name from public.workspaces where id = target_workspace_id;
      select coalesce(display_name, email) into v_inviter_name from public.profiles where id = auth.uid();

      insert into public.notifications (recipient_user_id, type, payload)
      values (
        invitee_id,
        'collaboration_invitation',
        jsonb_build_object(
          'workspace_id', target_workspace_id,
          'workspace_name', v_workspace_name,
          'inviter_user_id', auth.uid(),
          'inviter_name', v_inviter_name
        )
      );
    end if;

    return jsonb_build_object('outcome', 'member_invited', 'membership_id', result_row.id);
  end if;

  -- No account yet: record the invitation by email instead of failing.
  -- handle_new_user resolves it automatically once they sign up. No
  -- notification row here — there is no user to receive one yet.
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
