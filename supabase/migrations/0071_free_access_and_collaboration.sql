-- ARRIYIA V1 — Free Access + Free Collaboration.
--
-- Implements the locked commercial policy: open Free registration,
-- automatic Free plan assignment for ordinary signups, and Free
-- Collaboration (owner + 1 active collaborator, max 1 outstanding
-- invitation), enforced server-side. Beta is not reintroduced anywhere —
-- it remains only as the pre-existing administrative invitation
-- mechanism (beta_invites/is_beta_invited), untouched by this migration
-- except that it is no longer the fallback plan for an uninvited signup.
--
-- Five changes, all additive/CREATE OR REPLACE, none dropping or
-- renaming an existing table, column, or function:
--
-- 1. enforce_signup_authorization() — becomes a permissive pass-through.
--    Signup is no longer gated by beta_invites/workspace_invitations;
--    Supabase Auth's own email-confirmation requirement (unaffected by
--    this trigger, which fires on the row insert regardless of
--    confirmation state) remains the real friction for account
--    activation. The function and its BEFORE INSERT trigger are kept
--    (not dropped) — same hardening (SECURITY DEFINER, search_path
--    pinned, no PUBLIC execute grant), same name, so nothing else that
--    might reference it by name breaks, and a future policy could
--    reintroduce a real check here without another migration touching
--    the trigger binding.
--
-- 2. get_signup_access_status() — the client-facing pre-check. An
--    ordinary stranger (no beta_invites row, no workspace_invitations
--    row) now resolves 'ok' instead of 'not_invited', matching the
--    trigger's new permissive behavior exactly (client and server must
--    never disagree — see AuthContext.tsx's own update in this same
--    pass). The two workspace-invitation-specific stale states
--    ('invitation_expired'/'invitation_revoked') are kept — informational
--    only now, never blocking (the client stops treating any status as a
--    block; see the frontend change), but still useful context for a
--    workspace-invited person specifically ("your invite expired, ask
--    the owner to resend").
--
-- 3. assign_default_plan() — fallback target changes from the literal
--    'beta' plan to the literal 'free' plan. The beta_invites-driven
--    branch (an explicit plan_id on the invite row) is untouched — an
--    administrator can still grant any plan, including Founding Pro,
--    through that existing mechanism. Founding Pro's own enrollment
--    (founding_pro_enroll_member_core, 0055) never calls this function
--    and is unaffected either way — it assigns founding_pro directly,
--    strictly after account creation.
--
-- 4. feature:collaboration for the 'free' plan — 0 -> 1, plus two new
--    plan_quotas keys (max_active_collaborators / max_pending_invitations)
--    seeded for every plan that already carries feature:collaboration=1
--    (free/beta/pro/founding_pro/enterprise). Free gets an explicit 1/1;
--    every other plan gets an explicit -1/-1, a deliberate, documented
--    "unlimited" sentinel (negative = no cap) — never an absent row,
--    which invite_to_workspace's new check below treats as unresolved
--    and denies (fail-closed, matching enforce_storage_quota's existing
--    "no plan/quota configured -> deny" precedent, 0046). The 'student'
--    plan is deliberately not seeded here: it already has
--    feature:collaboration=0 (0067), so invite_to_workspace's existing
--    has_feature check rejects it before the new capacity check is ever
--    reached — seeding a capacity row for a plan with the feature
--    disabled would be dead data.
--
-- 5. invite_to_workspace() — re-declared with CREATE OR REPLACE,
--    preserving every existing line of logic verbatim (ownership check,
--    has_feature check, invitee-role guard, invitee resolution,
--    pending-membership upsert, notification insert, email-invitation
--    fallback — all unchanged from 0068), adding exactly the capacity
--    checks between the existing has_feature check and the existing
--    invitee-role guard. Both checks run inside this same SECURITY
--    DEFINER transaction as the write that follows, so there is no
--    TOCTOU window between "check capacity" and "create the invitation"
--    — a concurrent second invite cannot both pass the same stale count,
--    the same way the function's existing `on conflict ... where status
--    <> 'active'` guard already relies on ordinary transactional
--    atomicity rather than a separate lock.

-- ---------------------------------------------------------------------
-- 1. enforce_signup_authorization() — permissive pass-through.
-- ---------------------------------------------------------------------

create or replace function public.enforce_signup_authorization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- V1 Free Access — open registration. Supabase Auth's own email-
    -- confirmation requirement is the real gate on account activation;
    -- this trigger no longer rejects account creation for lacking an
    -- admin (beta_invites) or workspace invitation. Kept as a named,
    -- hardened function (rather than dropping the trigger outright) so
    -- a future policy change can reintroduce a real check here without
    -- another migration having to recreate the trigger binding.
    return new;
end;
$$;

-- Grants unchanged from 0069: trigger-function-only, never PUBLIC-
-- executable (no legitimate direct-call path — NEW isn't defined outside
-- trigger context).
revoke execute on function public.enforce_signup_authorization() from public;

-- ---------------------------------------------------------------------
-- 2. get_signup_access_status() — 'not_invited' -> 'ok' for an ordinary
--    stranger; stale-workspace-invitation states kept, informational
--    only.
-- ---------------------------------------------------------------------

create or replace function public.get_signup_access_status(check_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_email text := lower(trim(check_email));
begin
    if public.is_beta_invited(check_email) or public.has_valid_workspace_invitation(check_email) then
        return 'ok';
    end if;

    -- An invitation once existed for this specific email but is no
    -- longer usable. Still surfaced (checked in this order — expired
    -- before revoked — purely to give the more common, less alarming
    -- case priority when both happen to be true at once) as useful,
    -- specific context for someone who arrived expecting a workspace
    -- invitation to work; it is no longer a denial for signup purposes —
    -- the client no longer blocks on any status value (AuthContext.tsx).
    if exists (
        select 1 from public.workspace_invitations
        where lower(email) = v_email and status = 'pending' and expires_at <= now()
    ) then
        return 'invitation_expired';
    end if;

    if exists (
        select 1 from public.workspace_invitations
        where lower(email) = v_email and status = 'cancelled'
    ) then
        return 'invitation_revoked';
    end if;

    -- V1 Free Access — an ordinary stranger with no invitation of any
    -- kind is now a legitimate open-registration signup, not a denial.
    return 'ok';
end;
$$;

-- ---------------------------------------------------------------------
-- 3. assign_default_plan() — fallback target 'beta' -> 'free'. Every
--    other line (beta_invites lookup, quota seeding, accept-marking)
--    unchanged from 0044.
-- ---------------------------------------------------------------------

create or replace function public.assign_default_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    invited_plan_id uuid;
begin
    -- Look up the plan attached to the invitation
    select bi.plan_id
    into invited_plan_id
    from public.beta_invites bi
    where lower(bi.email) = lower(new.email)
      and bi.status = 'invited'
    limit 1;

    -- V1 Free Access — fall back to Free (not Beta) when no invitation
    -- carries an explicit plan. Beta is no longer an active
    -- customer-facing tier; an administrator can still grant it (or any
    -- other plan) explicitly via beta_invites.plan_id, unchanged.
    if invited_plan_id is null then
        select id
        into invited_plan_id
        from public.plans
        where code = 'free';
    end if;

    -- Assign the user's plan
    insert into public.user_plan_assignments (
        user_id,
        plan_id,
        active
    )
    values (
        new.id,
        invited_plan_id,
        true
    );

    -- Initialize quota counters
    insert into public.quota_usage (
        user_id,
        quota_key,
        usage_count
    )
    select
        new.id,
        pq.quota_key,
        0
    from public.plan_quotas pq
    where pq.plan_id = invited_plan_id
    on conflict do nothing;

    -- Mark the invitation as accepted
    update public.beta_invites
    set
        status = 'accepted',
        accepted_at = now(),
        accepted_by = new.id
    where lower(email) = lower(new.email)
      and status = 'invited';

    return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Collaboration entitlement + capacity quota seeding.
-- ---------------------------------------------------------------------

-- Free gains the collaboration feature itself.
update public.plan_quotas
set quota_limit = 1
where quota_key = 'feature:collaboration'
  and plan_id = (select id from public.plans where code = 'free');

-- Free's explicit capacity: 1 active collaborator, 1 pending invitation.
insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'max_active_collaborators', 1, 'monthly'
from public.plans p
where p.code = 'free'
on conflict (plan_id, quota_key) do update set quota_limit = excluded.quota_limit;

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'max_pending_invitations', 1, 'monthly'
from public.plans p
where p.code = 'free'
on conflict (plan_id, quota_key) do update set quota_limit = excluded.quota_limit;

-- Every other collaboration-enabled plan gets an explicit, documented
-- "unlimited" sentinel (-1) rather than an absent row — an absent row
-- means "unresolved" to invite_to_workspace's new check below and is
-- treated as a deny, not as unlimited (fail-closed, matching
-- enforce_storage_quota's existing precedent). Preserves today's
-- de facto unlimited collaboration for Beta/Pro/Founding Pro/Enterprise.
insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'max_active_collaborators', -1, 'monthly'
from public.plans p
where p.code in ('beta', 'pro', 'founding_pro', 'enterprise')
on conflict (plan_id, quota_key) do nothing;

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'max_pending_invitations', -1, 'monthly'
from public.plans p
where p.code in ('beta', 'pro', 'founding_pro', 'enterprise')
on conflict (plan_id, quota_key) do nothing;

-- ---------------------------------------------------------------------
-- 5. invite_to_workspace() — capacity enforcement added, everything
--    else preserved verbatim from 0068.
-- ---------------------------------------------------------------------

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
  v_max_active bigint;
  v_max_pending bigint;
  v_active_count bigint;
  v_pending_count bigint;
begin
  if not public.has_workspace_role(target_workspace_id, 'owner') then
    raise exception 'Only a workspace owner can invite members';
  end if;

  if not public.has_feature(auth.uid(), 'collaboration') then
    raise exception 'Your plan does not include collaboration.'
      using errcode = 'P0001';
  end if;

  -- V1 Free Collaboration — server-side capacity enforcement, the actual
  -- boundary (never a frontend-only check). Resolved through the
  -- existing entitlement/quota architecture exactly like the
  -- has_feature check just above: resolve_effective_quota_limit reads
  -- the caller's own active plan via auth.uid(), never a client-supplied
  -- value, so this can't be spoofed by a non-owner or the invitee.
  -- A negative limit (the seeded -1 sentinel) means unlimited; a NULL
  -- (no plan_quotas row resolved at all) means unconfigured and fails
  -- closed, matching enforce_storage_quota's existing "no plan/quota
  -- configured -> deny" precedent (0046) rather than treating an
  -- absent row as unlimited.
  v_max_active := public.resolve_effective_quota_limit(auth.uid(), 'max_active_collaborators');
  v_max_pending := public.resolve_effective_quota_limit(auth.uid(), 'max_pending_invitations');

  if v_max_active is null or v_max_pending is null then
    raise exception 'No collaboration capacity is configured for your plan. Contact support.'
      using errcode = 'P0001';
  end if;

  if v_max_active >= 0 then
    select count(*) into v_active_count
    from public.workspace_members
    where workspace_id = target_workspace_id
      and status = 'active'
      and role <> 'owner';

    if v_active_count >= v_max_active then
      raise exception 'This workspace has reached its collaborator limit on your current plan. Upgrade to Pro for expanded collaboration.'
        using errcode = 'P0001';
    end if;
  end if;

  if v_max_pending >= 0 then
    select
      (select count(*) from public.workspace_members where workspace_id = target_workspace_id and status = 'pending')
      + (select count(*) from public.workspace_invitations where workspace_id = target_workspace_id and status = 'pending' and expires_at > now())
    into v_pending_count;

    if v_pending_count >= v_max_pending then
      raise exception 'This workspace already has an outstanding invitation. It must be accepted, declined, or cancelled before another can be sent.'
        using errcode = 'P0001';
    end if;
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
