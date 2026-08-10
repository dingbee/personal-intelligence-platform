-- Phase 4 Commercial Architecture — feature entitlements + storage quota.
--
-- Reuses plan_quotas/resolve_effective_quota_limit exactly as-is (no
-- second quota engine, no new "entitlements" table): a boolean feature
-- flag is just a quota_key whose value is 0 or 1, and a quantitative
-- resource (storage) is just another quota_key with a real limit — both
-- shapes plan_quotas already stores generically, and both already
-- resolve through the existing plan-default/personal-override formula
-- with zero changes to that function.
--
-- Two new quota_key namespaces are introduced by this migration:
--
-- 1. 'feature:collaboration' (0 or 1) — the one capability the audit
--    identified as genuinely needing server-side, not just UI-side,
--    enforcement (invite_to_workspace is gated on it below). Provider
--    selection stays exactly as it is today — a client-side,
--    non-privileged UI decision (canSelectProvider) — because gating it
--    grants no actual privilege; centralizing it into the new TS
--    entitlement module is an organizational change only, not a new
--    server-side control, so it does not need a new quota_key.
--    "expanded_storage" is deliberately NOT a separate boolean flag —
--    it's fully expressed by the real 'storage_bytes' limit below
--    (Free's number vs. every paid plan's higher number), so a second
--    row would just duplicate the same fact under a different key.
--
-- 2. 'storage_bytes' — a real, plan-scoped storage ceiling. Values below
--    are seeded defaults (500MB Free / 5GB Beta,Pro,Founding Pro / 50GB
--    Enterprise), adjustable at any time via the existing
--    admin_update_plan_quota RPC exactly like ai_messages already is —
--    not a business/pricing decision baked into code, a starting number
--    chosen so storage enforcement can go live now rather than blocking
--    on a figure that was never going to be architecturally significant
--    either way.
--
-- Beta and Enterprise are given collaboration=1 (full access) rather
-- than being newly restricted: nothing gates collaboration today, so
-- existing beta testers already have de facto full access, and this
-- migration must not silently take capability away from them as a side
-- effect of introducing commercial gating for Free.

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'feature:collaboration', case when p.code = 'free' then 0 else 1 end, 'monthly'
from public.plans p
where p.code in ('free', 'beta', 'pro', 'founding_pro', 'enterprise')
on conflict (plan_id, quota_key) do nothing;

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'storage_bytes',
  case p.code
    when 'free' then 524288000        -- 500 MB
    when 'beta' then 5368709120        -- 5 GB
    when 'pro' then 5368709120         -- 5 GB
    when 'founding_pro' then 5368709120 -- 5 GB
    when 'enterprise' then 53687091200  -- 50 GB
  end,
  'monthly'
from public.plans p
where p.code in ('free', 'beta', 'pro', 'founding_pro', 'enterprise')
on conflict (plan_id, quota_key) do nothing;

-- ---------------------------------------------------------------------
-- has_feature(user_id, feature_key) — thin boolean wrapper over the
-- existing resolve_effective_quota_limit, namespaced under 'feature:'
-- so feature flags and quantitative quotas never collide in the same
-- key space. SECURITY DEFINER + STABLE, matching resolve_effective_-
-- quota_limit's own shape; inherits its self-or-admin authorization
-- check for free (no separate auth logic to get wrong), and is safe to
-- call from inside RLS policies (see invite_to_workspace below), the
-- same way has_workspace_role already is.
-- ---------------------------------------------------------------------

create or replace function public.has_feature(p_user_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.resolve_effective_quota_limit(p_user_id, 'feature:' || p_feature_key), 0) = 1;
$$;

revoke execute on function public.has_feature(uuid, text) from public, anon;
grant execute on function public.has_feature(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- calculate_user_storage_usage(user_id) — smallest safe usage
-- calculation: sums documents.file_size + assets.size_bytes for the
-- user. Computed on demand rather than incrementally tracked in
-- quota_usage on purpose — storage is a running total that only
-- shrinks on delete, which doesn't fit quota_usage's period-based
-- incrementing-counter shape (built for ai_messages, which only ever
-- goes up within a month and resets monthly); reusing that table for
-- storage would require either fabricating period resets that make no
-- sense for storage or teaching consume_quota's callers a second,
-- decrement-aware code path. A live SUM avoids that whole bookkeeping
-- class of bug at the cost of a cheap aggregate query.
-- ---------------------------------------------------------------------

create or replace function public.calculate_user_storage_usage(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(file_size) from public.documents where user_id = p_user_id), 0) +
    coalesce((select sum(size_bytes) from public.assets where owner_id = p_user_id), 0);
$$;

revoke execute on function public.calculate_user_storage_usage(uuid) from public, anon;
grant execute on function public.calculate_user_storage_usage(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- enforce_storage_quota() — BEFORE INSERT trigger on documents/assets.
-- Server-authoritative: this is the answer to "storage quota cannot be
-- bypassed client-side," since it runs regardless of what path the
-- insert came through (direct table insert under existing RLS, not just
-- the uploadDocument()/asset-upload client helpers). Computes the
-- user's current total + the size of the row being inserted against
-- their effective storage_bytes limit; raises rather than silently
-- truncating or allowing the write. A user with no active plan/quota
-- row (should not happen given assign_default_plan, but resolved
-- defensively) is denied rather than treated as unlimited.
-- ---------------------------------------------------------------------

create or replace function public.enforce_storage_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_incoming bigint;
  v_limit bigint;
  v_current bigint;
begin
  if tg_table_name = 'documents' then
    v_owner := new.user_id;
    v_incoming := coalesce(new.file_size, 0);
  elsif tg_table_name = 'assets' then
    v_owner := new.owner_id;
    v_incoming := coalesce(new.size_bytes, 0);
  else
    raise exception 'enforce_storage_quota() is not wired for table %', tg_table_name;
  end if;

  v_limit := public.resolve_effective_quota_limit(v_owner, 'storage_bytes');

  if v_limit is null then
    raise exception 'No active plan or storage quota configured for your account.';
  end if;

  v_current := public.calculate_user_storage_usage(v_owner);

  if v_current + v_incoming > v_limit then
    raise exception 'Storage quota exceeded: this upload would use % bytes of your % byte limit.', v_current + v_incoming, v_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_storage_quota_on_documents on public.documents;
create trigger enforce_storage_quota_on_documents
  before insert on public.documents
  for each row execute function public.enforce_storage_quota();

drop trigger if exists enforce_storage_quota_on_assets on public.assets;
create trigger enforce_storage_quota_on_assets
  before insert on public.assets
  for each row execute function public.enforce_storage_quota();

-- ---------------------------------------------------------------------
-- Collaboration entitlement boundary. invite_to_workspace is the one
-- action that actually grants collaboration (adding a second person to
-- a workspace) — workspace creation and single-owner use stay available
-- to every plan (Free retains the full personal-intelligence
-- workspace), consistent with "do not cripple Free artificially."
-- Re-declared with CREATE OR REPLACE, preserving every existing line
-- of logic verbatim (invite target resolution, pending-invitation
-- upsert, email-based invitation fallback) and adding exactly one new
-- check at the top, in the same place/style as the existing
-- has_workspace_role ownership check right below it.
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
