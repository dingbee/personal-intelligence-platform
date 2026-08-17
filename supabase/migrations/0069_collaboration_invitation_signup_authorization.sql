-- ARRIYIA V1 — Replace the beta-only signup gate with a dual-path
-- authorization: Collaboration invitations are now a first-class, fully
-- sufficient basis for account creation, alongside (not instead of) the
-- existing admin-driven beta_invites allowlist.
--
-- Read-only audit findings this migration acts on (see the accompanying
-- report for the full trace):
--
-- 1. `enforce_beta_invite_gate_before_insert` (0034_beta_invite_quota_
--    repair.sql) is a BEFORE INSERT trigger on auth.users — it runs
--    before `handle_new_user`'s AFTER INSERT reconciliation of pending
--    `workspace_invitations` rows into `workspace_members` (0032). A
--    workspace owner could invite a genuinely new person via
--    `invite_to_workspace`, and that person's own attempt to accept —
--    which is just signing up — was unconditionally blocked unless their
--    email also happened to have an independent, unrelated `beta_invites`
--    row. The two systems were never connected. This migration connects
--    them at the one point that matters: the account-creation gate
--    itself.
--
-- 2. `beta_invites` is NOT being removed. It still has two live,
--    legitimate purposes verified directly in this schema:
--      a. `admin_list_users()` (0041_user_quota_overrides.sql) LEFT JOINs
--         it purely for display in the admin dashboard — historical/
--         reporting use, unaffected by this migration.
--      b. `assign_default_plan()` (0044_commercial_schema_reconciliation.
--         sql, AFTER INSERT) reads it to resolve a newly-created user's
--         starting plan, already falling back gracefully to the 'beta'
--         plan by code when no matching row exists — this was already
--         written to tolerate a signup with zero `beta_invites` rows, so
--         it needs no change here.
--    `beta_invites` also remains the admin's own manual "grant this
--    specific person access outside any workspace" mechanism — a real,
--    still-needed capability distinct from workspace invitations (which
--    require an inviting workspace owner). Founding Pro does not depend
--    on it either: `founding_pro_applications`/`founding_pro_invitations`
--    (0052/0055) are their own tables, and a Founding Pro applicant must
--    already have an ARRIYIA account before applying — this migration's
--    new invitation path is exactly what makes that account reachable
--    for someone who only has a workspace invitation, same as it makes
--    Collaboration itself reachable.
--
-- 3. This migration does NOT make signup generally public. An email with
--    neither a `beta_invites` row (status = 'invited') nor a valid
--    pending, unexpired `workspace_invitations` row is still rejected at
--    the database level, unconditionally, before any row is inserted.

-- ---------------------------------------------------------------------
-- 1. has_valid_workspace_invitation() — the authorization predicate.
--    Mirrors is_beta_invited()'s exact shape (language sql, security
--    definer, search_path pinned, default PUBLIC execute grant retained
--    deliberately — see that function's own migration comment, 0044) so
--    the client can pre-check it the same way it already pre-checks beta
--    status, before ever attempting signUp.
--
--    Scoped precisely to avoid the exact risk this migration must not
--    introduce ("could an attacker create an account because their email
--    merely appears somewhere in an unrelated record?"): this reads only
--    `workspace_invitations`, only `status = 'pending'`, only
--    `expires_at > now()`. It does not consult `workspace_members`,
--    `profiles`, or any other table an email might incidentally appear
--    in.
-- ---------------------------------------------------------------------

create or replace function public.has_valid_workspace_invitation(check_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.workspace_invitations
        where lower(email) = lower(trim(check_email))
          and status = 'pending'
          and expires_at > now()
    );
$$;

-- ---------------------------------------------------------------------
-- 2. get_signup_access_status() — a richer, client-facing classifier
--    used only for pre-signup UX messaging (Workstream 6's five-way
--    distinction: valid / expired / revoked / none / unexpected-error).
--    This function is informational only and carries no authorization
--    weight of its own — enforce_signup_authorization() below is the
--    sole enforcement point, exactly as enforce_beta_invite_gate's own
--    original design note insisted ("the only enforcement point that
--    covers every account-creation path uniformly"). A client trusting
--    this function's 'ok' result and skipping the real signUp() call
--    would just get nothing to happen; it cannot be used to fabricate an
--    account.
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

    -- An invitation once existed for this email but is no longer usable.
    -- Checked in this order (expired before revoked) only to give the
    -- more common, less alarming case priority when both happen to be
    -- true at once; neither check reveals which workspace or who invited
    -- them.
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

    return 'not_invited';
end;
$$;

-- ---------------------------------------------------------------------
-- 3. enforce_signup_authorization() — replaces enforce_beta_invite_gate.
--    Dropped and recreated under an accurate name rather than
--    `create or replace`d in place: it is no longer only a beta gate,
--    and leaving the old name would mislead the next reader into
--    thinking workspace-invited signups are still unconditionally
--    blocked. Same BEFORE INSERT timing, same unconditional-reject
--    posture, same security-definer/search_path hardening as the
--    function it replaces.
-- ---------------------------------------------------------------------

drop trigger if exists enforce_beta_invite_gate_before_insert on auth.users;
drop function if exists public.enforce_beta_invite_gate();

create function public.enforce_signup_authorization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if public.is_beta_invited(new.email) or public.has_valid_workspace_invitation(new.email) then
        return new;
    end if;

    raise exception 'This email is not authorized to create an account. An admin invitation or a pending workspace invitation is required.'
        using errcode = 'P0001';
end;
$$;

create trigger enforce_signup_authorization_before_insert
    before insert on auth.users
    for each row execute function public.enforce_signup_authorization();

-- New functions inherit Postgres's default EXECUTE-to-PUBLIC grant unless
-- revoked (0042's own precedent/comment). enforce_signup_authorization is
-- a trigger function only — nobody should invoke it directly as an RPC
-- (NEW isn't defined outside trigger context; a direct call would just
-- error, but it shouldn't be reachable at all), matching
-- enforce_beta_invite_gate's exact prior posture. The two new anon-facing
-- functions above are deliberately left with their default grant, for
-- the same reason is_beta_invited was deliberately left alone: the
-- client must be able to call them before the user is authenticated
-- (pre-signup).
revoke execute on function public.enforce_signup_authorization() from public;
