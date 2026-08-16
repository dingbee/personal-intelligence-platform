-- Notification Foundation Phase 1 — security test. Same conventions as
-- pro_intelligence_foundation_security_test.sql: each numbered block is a
-- self-contained `begin; ... rollback;` transaction, `request.jwt.claims`
-- simulates a real authenticated session. Covers three things: (1) the
-- `notifications` table's own RLS shape (recipient-only select, no
-- client insert/update at all — every write goes through a SECURITY
-- DEFINER function), (2) the two new RPCs' recipient-only write
-- isolation, and (3) `invite_to_workspace`'s new notification-emission
-- logic — exactly one notification on a genuinely new invite, none on a
-- failed invite, none on a resend of an already-pending invite, and a
-- fresh one on a genuine re-invite after removal.
--
-- Users reused from pro_intelligence_foundation_security_test.sql (same
-- vetted, safe-to-mutate-within-a-rollback set):
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com) — "owner"
--   249c4f9a-fe94-4174-af49-ca38d526caba (innozelothe@gmail.com) — "recipient"
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co) — "attacker"
--
-- Deliberately does NOT reuse 5e0f4eea-7bf3-4ccf-83f7-c6d6f199dda1
-- (engutoto@gmail.com) — that user has a real, live pending Founding Pro
-- application and must never be touched, even inside a rolled-back
-- transaction.

-- ---------------------------------------------------------------------
-- 1. A genuinely new invitation of an existing user creates exactly one
--    notification, addressed to the correct recipient, with the correct
--    type and payload.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_pro_plan uuid;
  v_workspace_id uuid;
  v_result jsonb;
  v_notification record;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';

  select id into v_pro_plan from public.plans where code = 'pro';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_pro_plan, true);

  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Notification Test Workspace 1')
    returning id into v_workspace_id;

  select public.invite_to_workspace(v_workspace_id, 'innozelothe@gmail.com', 'editor') into v_result;

  if v_result->>'outcome' <> 'member_invited' then
    raise exception 'NOTIFICATIONS TEST FAILED (1): expected member_invited outcome, got %', v_result;
  end if;

  select count(*) into v_count
  from public.notifications
  where recipient_user_id = '249c4f9a-fe94-4174-af49-ca38d526caba'
    and type = 'collaboration_invitation'
    and (payload->>'workspace_id')::uuid = v_workspace_id;

  if v_count <> 1 then
    raise exception 'NOTIFICATIONS TEST FAILED (1): expected exactly 1 notification, got %', v_count;
  end if;

  select * into v_notification
  from public.notifications
  where recipient_user_id = '249c4f9a-fe94-4174-af49-ca38d526caba'
    and (payload->>'workspace_id')::uuid = v_workspace_id;

  if v_notification.payload->>'inviter_user_id' <> '313866d5-4ab7-4d65-bda9-67b9bd668f2d' then
    raise exception 'NOTIFICATIONS TEST FAILED (1): payload inviter_user_id does not match the actual inviter';
  end if;

  if v_notification.read_at is not null then
    raise exception 'NOTIFICATIONS TEST FAILED (1): a freshly created notification must be unread';
  end if;

  raise notice 'NOTIFICATIONS TEST (1) PASSED: a new invitation creates exactly one correctly-addressed notification';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 2. A different authenticated user cannot select the recipient's
--    notification, even knowing the workspace id (RLS isolation).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_pro_plan uuid;
  v_workspace_id uuid;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_pro_plan from public.plans where code = 'pro';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_pro_plan, true);
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Notification Test Workspace 2')
    returning id into v_workspace_id;
  perform public.invite_to_workspace(v_workspace_id, 'innozelothe@gmail.com', 'editor');

  set local "request.jwt.claims" = '{"sub":"9e733cfc-e6ae-45e6-8b14-dc64247a9cb2","role":"authenticated"}';
  select count(*) into v_count
  from public.notifications
  where recipient_user_id = '249c4f9a-fe94-4174-af49-ca38d526caba';

  if v_count <> 0 then
    raise exception 'NOTIFICATIONS TEST FAILED (2): a different authenticated user could see another user''s notification';
  end if;

  raise notice 'NOTIFICATIONS TEST (2) PASSED: RLS hides another user''s notifications entirely';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. mark_notification_read only marks the *caller's own* notification.
--    A different user calling it with the recipient's notification id is
--    a silent no-op (not an error, not a mutation) — the row stays
--    unread until the actual recipient marks it.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_pro_plan uuid;
  v_workspace_id uuid;
  v_notification_id uuid;
  v_read_at timestamptz;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_pro_plan from public.plans where code = 'pro';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_pro_plan, true);
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Notification Test Workspace 3')
    returning id into v_workspace_id;
  perform public.invite_to_workspace(v_workspace_id, 'innozelothe@gmail.com', 'editor');

  select id into v_notification_id from public.notifications
    where recipient_user_id = '249c4f9a-fe94-4174-af49-ca38d526caba'
      and (payload->>'workspace_id')::uuid = v_workspace_id;

  -- Attacker attempts to mark the recipient's notification read.
  set local "request.jwt.claims" = '{"sub":"9e733cfc-e6ae-45e6-8b14-dc64247a9cb2","role":"authenticated"}';
  perform public.mark_notification_read(v_notification_id);

  -- Only the recipient can see whether it actually changed.
  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
  select read_at into v_read_at from public.notifications where id = v_notification_id;
  if v_read_at is not null then
    raise exception 'NOTIFICATIONS TEST FAILED (3a): a non-recipient marked another user''s notification read';
  end if;

  perform public.mark_notification_read(v_notification_id);
  select read_at into v_read_at from public.notifications where id = v_notification_id;
  if v_read_at is null then
    raise exception 'NOTIFICATIONS TEST FAILED (3b): the actual recipient could not mark their own notification read';
  end if;

  raise notice 'NOTIFICATIONS TEST (3) PASSED: mark_notification_read is isolated to the caller''s own notifications';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 4. mark_all_notifications_read only affects the caller's own rows.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_pro_plan uuid;
  v_workspace_id uuid;
  v_notification_id uuid;
  v_read_at timestamptz;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_pro_plan from public.plans where code = 'pro';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_pro_plan, true);
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Notification Test Workspace 4')
    returning id into v_workspace_id;
  perform public.invite_to_workspace(v_workspace_id, 'innozelothe@gmail.com', 'editor');

  select id into v_notification_id from public.notifications
    where recipient_user_id = '249c4f9a-fe94-4174-af49-ca38d526caba'
      and (payload->>'workspace_id')::uuid = v_workspace_id;

  set local "request.jwt.claims" = '{"sub":"9e733cfc-e6ae-45e6-8b14-dc64247a9cb2","role":"authenticated"}';
  perform public.mark_all_notifications_read();

  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
  select read_at into v_read_at from public.notifications where id = v_notification_id;
  if v_read_at is not null then
    raise exception 'NOTIFICATIONS TEST FAILED (4a): another user''s mark_all_notifications_read affected the recipient''s notification';
  end if;

  perform public.mark_all_notifications_read();
  select read_at into v_read_at from public.notifications where id = v_notification_id;
  if v_read_at is null then
    raise exception 'NOTIFICATIONS TEST FAILED (4b): the recipient''s own mark_all_notifications_read did not mark their notification read';
  end if;

  raise notice 'NOTIFICATIONS TEST (4) PASSED: mark_all_notifications_read is isolated to the caller''s own notifications';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 5. A failed invitation creates no notification: (a) the inviter lacks
--    the collaboration entitlement, (b) the caller is not the workspace
--    owner.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_free_plan uuid;
  v_workspace_id uuid;
  v_count integer;
  v_failed boolean := false;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_free_plan from public.plans where code = 'free';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_free_plan, true);
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Notification Test Workspace 5a')
    returning id into v_workspace_id;

  begin
    perform public.invite_to_workspace(v_workspace_id, 'innozelothe@gmail.com', 'editor');
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'NOTIFICATIONS TEST FAILED (5a): a Free-plan owner''s invite should have been rejected';
  end if;

  select count(*) into v_count from public.notifications
    where recipient_user_id = '249c4f9a-fe94-4174-af49-ca38d526caba'
      and (payload->>'workspace_id')::uuid = v_workspace_id;
  if v_count <> 0 then
    raise exception 'NOTIFICATIONS TEST FAILED (5a): a rejected (entitlement) invite still created a notification';
  end if;

  -- (b) a non-owner attempting to invite.
  v_failed := false;
  set local "request.jwt.claims" = '{"sub":"9e733cfc-e6ae-45e6-8b14-dc64247a9cb2","role":"authenticated"}';
  begin
    perform public.invite_to_workspace(v_workspace_id, 'innozelothe@gmail.com', 'editor');
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'NOTIFICATIONS TEST FAILED (5b): a non-owner''s invite should have been rejected';
  end if;

  select count(*) into v_count from public.notifications
    where recipient_user_id = '249c4f9a-fe94-4174-af49-ca38d526caba'
      and (payload->>'workspace_id')::uuid = v_workspace_id;
  if v_count <> 0 then
    raise exception 'NOTIFICATIONS TEST FAILED (5b): a rejected (non-owner) invite still created a notification';
  end if;

  raise notice 'NOTIFICATIONS TEST (5) PASSED: a failed invitation never creates a notification';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 6. Resending an invitation that is already pending does not create a
--    second notification; a genuine re-invite after removal does.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_pro_plan uuid;
  v_workspace_id uuid;
  v_membership_id uuid;
  v_result jsonb;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_pro_plan from public.plans where code = 'pro';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_pro_plan, true);
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Notification Test Workspace 6')
    returning id into v_workspace_id;

  select public.invite_to_workspace(v_workspace_id, 'innozelothe@gmail.com', 'editor') into v_result;
  v_membership_id := (v_result->>'membership_id')::uuid;

  -- Resend while still pending: same outcome, no second notification.
  perform public.invite_to_workspace(v_workspace_id, 'innozelothe@gmail.com', 'viewer');

  select count(*) into v_count from public.notifications
    where recipient_user_id = '249c4f9a-fe94-4174-af49-ca38d526caba'
      and (payload->>'workspace_id')::uuid = v_workspace_id;
  if v_count <> 1 then
    raise exception 'NOTIFICATIONS TEST FAILED (6a): resending an already-pending invite created % notifications, expected 1', v_count;
  end if;

  -- Recipient declines (removes the pending row), then is re-invited —
  -- this is a materially new event and should notify again.
  update public.workspace_members set status = 'removed' where id = v_membership_id;

  perform public.invite_to_workspace(v_workspace_id, 'innozelothe@gmail.com', 'editor');

  select count(*) into v_count from public.notifications
    where recipient_user_id = '249c4f9a-fe94-4174-af49-ca38d526caba'
      and (payload->>'workspace_id')::uuid = v_workspace_id;
  if v_count <> 2 then
    raise exception 'NOTIFICATIONS TEST FAILED (6b): a genuine re-invite after removal produced % notifications, expected 2', v_count;
  end if;

  raise notice 'NOTIFICATIONS TEST (6) PASSED: resending a pending invite does not duplicate; re-inviting after removal does notify again';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 7. No client-side insert path exists: an authenticated user cannot
--    fabricate a notification for themselves or anyone else via a plain
--    table insert (there is no INSERT policy at all on `notifications`).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_failed boolean := false;
begin
  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';

  begin
    insert into public.notifications (recipient_user_id, type, payload)
      values ('249c4f9a-fe94-4174-af49-ca38d526caba', 'collaboration_invitation', '{}'::jsonb);
  exception when others then
    v_failed := true;
  end;

  if not v_failed then
    raise exception 'NOTIFICATIONS TEST FAILED (7): a client could insert a notification directly, bypassing invite_to_workspace';
  end if;

  raise notice 'NOTIFICATIONS TEST (7) PASSED: there is no client-side insert path for notifications';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 8. No client-side update path exists either: even the recipient
--    cannot mark their own notification read via a plain table update —
--    mark_notification_read is the only way.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_pro_plan uuid;
  v_workspace_id uuid;
  v_notification_id uuid;
  v_updated integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_pro_plan from public.plans where code = 'pro';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_pro_plan, true);
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Notification Test Workspace 8')
    returning id into v_workspace_id;
  perform public.invite_to_workspace(v_workspace_id, 'innozelothe@gmail.com', 'editor');

  select id into v_notification_id from public.notifications
    where recipient_user_id = '249c4f9a-fe94-4174-af49-ca38d526caba'
      and (payload->>'workspace_id')::uuid = v_workspace_id;

  set local "request.jwt.claims" = '{"sub":"249c4f9a-fe94-4174-af49-ca38d526caba","role":"authenticated"}';
  update public.notifications set read_at = now() where id = v_notification_id;
  get diagnostics v_updated = row_count;

  if v_updated <> 0 then
    raise exception 'NOTIFICATIONS TEST FAILED (8): the recipient updated their own notification via a plain table update';
  end if;

  raise notice 'NOTIFICATIONS TEST (8) PASSED: there is no client-side update path for notifications, only mark_notification_read';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 9. Unauthenticated (anon) access is denied outright.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_pro_plan uuid;
  v_workspace_id uuid;
  v_count integer;
begin
  set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
  select id into v_pro_plan from public.plans where code = 'pro';
  update public.user_plan_assignments set active = false, ends_at = now()
    where user_id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d' and active = true;
  insert into public.user_plan_assignments (user_id, plan_id, active)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', v_pro_plan, true);
  insert into public.workspaces (user_id, name) values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Notification Test Workspace 9')
    returning id into v_workspace_id;
  perform public.invite_to_workspace(v_workspace_id, 'innozelothe@gmail.com', 'editor');

  set local "request.jwt.claims" = '{"role":"anon"}';
  set local role anon;
  select count(*) into v_count from public.notifications;
  reset role;

  if v_count <> 0 then
    raise exception 'NOTIFICATIONS TEST FAILED (9): an unauthenticated (anon) request could see notifications';
  end if;

  raise notice 'NOTIFICATIONS TEST (9) PASSED: unauthenticated access sees no notifications';
end;
$$;

rollback;
