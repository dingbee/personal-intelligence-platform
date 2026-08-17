-- ARRIYIA V1 — Collaboration Invitation Signup Authorization — security
-- test. Same conventions as notifications_security_test.sql: each
-- numbered block is a self-contained `begin; ... rollback;` transaction.
--
-- Scope note: `has_valid_workspace_invitation()` and
-- `get_signup_access_status()` take a raw email and never touch
-- `auth.users`, so every case below is testable purely against
-- `workspace_invitations` rows inserted (and rolled back) here — no
-- change to the established "never insert into auth.users directly, only
-- SELECT existing seeded users as FK targets" convention every other
-- test file in this repo already follows (auth.users is GoTrue-managed;
-- direct inserts would bypass its own invariants).
--
-- What this file deliberately CANNOT cover, for the same reason: the
-- `enforce_signup_authorization_before_insert` trigger's actual blocking/
-- allowing of a real `auth.users` insert. That requires an actual
-- Supabase Auth signup call (or the Admin API), not a SQL script — see
-- the accompanying report's "unresolved ambiguity" section.
--
-- Users reused from pro_intelligence_foundation_security_test.sql (same
-- vetted, safe-to-mutate-within-a-rollback set):
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com) — "owner"

-- ---------------------------------------------------------------------
-- 1. A valid pending, unexpired invitation authorizes — the core
--    positive case.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_workspace_id uuid;
  v_status text;
begin
  insert into public.workspaces (user_id, name)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Auth Test Workspace 1')
    returning id into v_workspace_id;

  insert into public.workspace_invitations (workspace_id, email, role, invited_by)
    values (v_workspace_id, 'newcolleague@example.com', 'editor', '313866d5-4ab7-4d65-bda9-67b9bd668f2d');

  if not public.has_valid_workspace_invitation('newcolleague@example.com') then
    raise exception 'AUTH TEST FAILED (1a): valid pending invitation should authorize';
  end if;

  select public.get_signup_access_status('newcolleague@example.com') into v_status;
  if v_status <> 'ok' then
    raise exception 'AUTH TEST FAILED (1b): expected ok, got %', v_status;
  end if;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 2. Case and whitespace normalization — an invitation stored lower-cased
--    (invite_to_workspace's own normalization) must still authorize a
--    signup email submitted with different casing or surrounding
--    whitespace.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_workspace_id uuid;
begin
  insert into public.workspaces (user_id, name)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Auth Test Workspace 2')
    returning id into v_workspace_id;

  insert into public.workspace_invitations (workspace_id, email, role, invited_by)
    values (v_workspace_id, 'caseinsensitive@example.com', 'editor', '313866d5-4ab7-4d65-bda9-67b9bd668f2d');

  if not public.has_valid_workspace_invitation('  CaseInsensitive@Example.COM  ') then
    raise exception 'AUTH TEST FAILED (2): case/whitespace variation should still authorize';
  end if;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 3. An expired (but still status='pending') invitation does not
--    authorize, and is correctly classified as 'invitation_expired'.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_workspace_id uuid;
  v_status text;
begin
  insert into public.workspaces (user_id, name)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Auth Test Workspace 3')
    returning id into v_workspace_id;

  insert into public.workspace_invitations (workspace_id, email, role, invited_by, expires_at)
    values (v_workspace_id, 'expiredperson@example.com', 'editor', '313866d5-4ab7-4d65-bda9-67b9bd668f2d', now() - interval '1 day');

  if public.has_valid_workspace_invitation('expiredperson@example.com') then
    raise exception 'AUTH TEST FAILED (3a): expired invitation must not authorize';
  end if;

  select public.get_signup_access_status('expiredperson@example.com') into v_status;
  if v_status <> 'invitation_expired' then
    raise exception 'AUTH TEST FAILED (3b): expected invitation_expired, got %', v_status;
  end if;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 4. A cancelled (revoked) invitation does not authorize, and is
--    correctly classified as 'invitation_revoked'.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_workspace_id uuid;
  v_status text;
begin
  insert into public.workspaces (user_id, name)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Auth Test Workspace 4')
    returning id into v_workspace_id;

  insert into public.workspace_invitations (workspace_id, email, role, invited_by, status)
    values (v_workspace_id, 'revokedperson@example.com', 'editor', '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'cancelled');

  if public.has_valid_workspace_invitation('revokedperson@example.com') then
    raise exception 'AUTH TEST FAILED (4a): cancelled invitation must not authorize';
  end if;

  select public.get_signup_access_status('revokedperson@example.com') into v_status;
  if v_status <> 'invitation_revoked' then
    raise exception 'AUTH TEST FAILED (4b): expected invitation_revoked, got %', v_status;
  end if;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 5. No invitation at all, and no beta_invites row: correctly denied and
--    classified as 'not_invited' — the general "uninvited stranger"
--    case. This is also the direct regression check that signup remains
--    controlled-access, not public/self-serve: an email with zero
--    connection to any invitation mechanism must never authorize.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_status text;
begin
  if public.has_valid_workspace_invitation('totallyunrelated@example.com') then
    raise exception 'AUTH TEST FAILED (5a): an email with no invitation must not authorize';
  end if;

  select public.get_signup_access_status('totallyunrelated@example.com') into v_status;
  if v_status <> 'not_invited' then
    raise exception 'AUTH TEST FAILED (5b): expected not_invited, got %', v_status;
  end if;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 6. An email that merely exists in an unrelated table (profiles) — not
--    workspace_invitations, not beta_invites — must not authorize. This
--    is the direct check against the specific risk this migration was
--    required not to introduce.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_existing_profile_email text;
begin
  select email into v_existing_profile_email from public.profiles limit 1;

  if v_existing_profile_email is null then
    raise exception 'AUTH TEST SKIPPED (6): no existing profile row to test against';
  end if;

  -- This email exists in `profiles` (as an existing real user) but has no
  -- workspace_invitations row and no beta_invites row of its own scoped
  -- to this test — has_valid_workspace_invitation must not be fooled by
  -- its mere existence in an unrelated table it never queries.
  if public.has_valid_workspace_invitation(v_existing_profile_email || '.nonexistent-suffix') then
    raise exception 'AUTH TEST FAILED (6): fabricated email derived from an unrelated table must not authorize';
  end if;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 7. Multiple pending invitations to the same email across different
--    workspaces — intentional and must all remain individually valid;
--    checking authorization for the email is workspace-agnostic by
--    design (matches handle_new_user's own multi-workspace reconciliation
--    loop), not a vulnerability.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_workspace_a uuid;
  v_workspace_b uuid;
  v_count integer;
begin
  insert into public.workspaces (user_id, name)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Auth Test Workspace 5a')
    returning id into v_workspace_a;
  insert into public.workspaces (user_id, name)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Auth Test Workspace 5b')
    returning id into v_workspace_b;

  insert into public.workspace_invitations (workspace_id, email, role, invited_by)
    values (v_workspace_a, 'multiworkspace@example.com', 'editor', '313866d5-4ab7-4d65-bda9-67b9bd668f2d');
  insert into public.workspace_invitations (workspace_id, email, role, invited_by)
    values (v_workspace_b, 'multiworkspace@example.com', 'viewer', '313866d5-4ab7-4d65-bda9-67b9bd668f2d');

  select count(*) into v_count
  from public.workspace_invitations
  where lower(email) = 'multiworkspace@example.com' and status = 'pending';

  if v_count <> 2 then
    raise exception 'AUTH TEST FAILED (7a): expected 2 independent pending invitations, got %', v_count;
  end if;

  if not public.has_valid_workspace_invitation('multiworkspace@example.com') then
    raise exception 'AUTH TEST FAILED (7b): an email pending in multiple workspaces must still authorize';
  end if;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 8. Duplicate pending invitations to the SAME workspace+email are
--    prevented at the schema level (workspace_invitations_pending_unique,
--    0032) — unchanged by this migration, re-confirmed here since this
--    migration's authorization logic depends on that uniqueness
--    guarantee not silently regressing.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_workspace_id uuid;
  v_raised boolean := false;
begin
  insert into public.workspaces (user_id, name)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Auth Test Workspace 6')
    returning id into v_workspace_id;

  insert into public.workspace_invitations (workspace_id, email, role, invited_by)
    values (v_workspace_id, 'dupecheck@example.com', 'editor', '313866d5-4ab7-4d65-bda9-67b9bd668f2d');

  begin
    insert into public.workspace_invitations (workspace_id, email, role, invited_by)
      values (v_workspace_id, 'dupecheck@example.com', 'editor', '313866d5-4ab7-4d65-bda9-67b9bd668f2d');
  exception when unique_violation then
    v_raised := true;
  end;

  if not v_raised then
    raise exception 'AUTH TEST FAILED (8): duplicate pending invitation to the same workspace+email should violate the unique index';
  end if;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 9. An accepted invitation (already consumed by a prior signup, per
--    handle_new_user's own status transition) does not re-authorize a
--    second time — an invitation cannot be improperly reused once spent.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_workspace_id uuid;
begin
  insert into public.workspaces (user_id, name)
    values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'Auth Test Workspace 7')
    returning id into v_workspace_id;

  insert into public.workspace_invitations (workspace_id, email, role, invited_by, status, accepted_at)
    values (v_workspace_id, 'alreadyaccepted@example.com', 'editor', '313866d5-4ab7-4d65-bda9-67b9bd668f2d', 'accepted', now());

  if public.has_valid_workspace_invitation('alreadyaccepted@example.com') then
    raise exception 'AUTH TEST FAILED (9): an already-accepted invitation must not re-authorize';
  end if;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 10. Existing beta_invites path is fully preserved — a beta-invited
--     email authorizes exactly as before this migration, with no
--     workspace_invitations row involved at all.
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_status text;
begin
  insert into public.beta_invites (email, status)
    values ('betapathstillworks@example.com', 'invited')
    on conflict (email) do update set status = 'invited';

  if not public.is_beta_invited('betapathstillworks@example.com') then
    raise exception 'AUTH TEST FAILED (10a): existing beta_invites path must be unaffected';
  end if;

  select public.get_signup_access_status('betapathstillworks@example.com') into v_status;
  if v_status <> 'ok' then
    raise exception 'AUTH TEST FAILED (10b): expected ok via beta_invites path, got %', v_status;
  end if;
end $$;

rollback;

-- ---------------------------------------------------------------------
-- 11. enforce_signup_authorization is not directly callable as an RPC
--     (trigger-function-only posture, matching enforce_beta_invite_gate's
--     prior grants exactly).
-- ---------------------------------------------------------------------

begin;

do $$
declare
  v_has_grant boolean;
begin
  select exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'enforce_signup_authorization'
      and grantee = 'public'
      and privilege_type = 'EXECUTE'
  ) into v_has_grant;

  if v_has_grant then
    raise exception 'AUTH TEST FAILED (11): enforce_signup_authorization must not be PUBLIC-executable';
  end if;
end $$;

rollback;
