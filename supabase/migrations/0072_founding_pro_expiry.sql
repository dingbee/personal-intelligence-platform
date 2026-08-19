-- ARRIYIA V1 — Founding Pro Expiry & Lifecycle.
--
-- Closes the confirmed gap: founding_pro_members.founding_expires_at
-- (0052/0055) has been recorded at enrollment since Founding Pro shipped,
-- but nothing ever reads it — resolve_effective_quota_limit resolves a
-- user's plan purely from user_plan_assignments.active, never by date,
-- so a Founding Pro member remains Founding Pro indefinitely past their
-- 3-month term. This migration adds the one thing that was missing: a
-- scheduled sweep that transitions expired members, plus the bookkeeping
-- for the other side of the lifecycle (conversion to normal Pro), using
-- exactly the entitlement mechanism that already exists.
--
-- Four changes, all additive:
--
-- 1. founding_pro_members.transition_status — widened from
--    ('active','transitioned') to ('active','converted_to_pro',
--    'expired_to_free','transitioned'). 'transitioned' is kept (not
--    dropped) purely for backward compatibility with any historical row
--    that might already carry it — nothing in this codebase has ever
--    written that value (confirmed by inspection), so no backfill is
--    needed, but the value is not forcibly disallowed either. All new
--    transitions from this migration forward use the two explicit
--    values.
--
-- 2. founding_pro_events.event_type — gains 'converted_to_pro' and
--    'expired_to_free'. The existing generic 'transition_completed'
--    value is kept (also never written by anything) rather than
--    removed, so no historical event row (if any exist) is ever
--    invalidated by this migration.
--
-- 3. expire_founding_pro_members() — new SECURITY DEFINER function, the
--    one new piece of business logic this migration adds. Idempotent by
--    construction (only ever selects transition_status = 'active' rows;
--    once a row is transitioned it is never selected again) and safe
--    under concurrent execution (FOR UPDATE SKIP LOCKED — a second
--    concurrent run skips whatever the first is already holding).
--    Granted to nobody (revoke all from public/anon/authenticated) —
--    intended for pg_cron execution only, which runs as the scheduling
--    role (not through PostgREST/supabase.rpc, so no client grant is
--    needed or wanted).
--
--    Per member, re-reads the user's CURRENT active plan before touching
--    anything (never trusts founding_pro_members.transition_status alone
--    to imply the user is still actually on the founding_pro plan — an
--    admin or a Pesapal conversion may have already moved them):
--      a. still on founding_pro -> deactivate it, activate Free, mark
--         expired_to_free.
--      b. already on pro -> no entitlement change (already correct),
--         mark converted_to_pro (covers the case where a webhook
--         converted them but the sweep runs before or racing with the
--         apply_subscription_event bookkeeping added in this same
--         migration — see its own comment).
--      c. on any other active plan (an administrator explicitly moved
--         them elsewhere, e.g. Enterprise) -> never touch
--         user_plan_assignments, record an audit event only. The
--         administrator's explicit decision is never overwritten.
--
-- 4. apply_subscription_event() — re-declared with CREATE OR REPLACE,
--    preserving every existing line of logic verbatim (idempotency
--    guard, out-of-order guard, the full 'active'/'past_due' and
--    'cancelled'/'expired' branches, the audit insert), adding exactly
--    one new step at the end of the 'active'/'past_due' branch: when the
--    applied plan is 'pro' and the user has a live (transition_status=
--    'active') founding_pro_members row, mark it converted_to_pro and
--    record the event. This never fires for the overwhelming majority of
--    subscription events (any user who isn't currently an active
--    Founding Pro member converting to Pro) — the UPDATE's own WHERE
--    clause is a no-op for everyone else, so no existing billing
--    behavior changes.

-- ---------------------------------------------------------------------
-- 1 & 2. Widen the two CHECK constraints. Both are unnamed inline column
-- checks (0052), so their auto-generated names are looked up dynamically
-- rather than hardcoded/guessed, and dropped only if found — safe to
-- re-run.
-- ---------------------------------------------------------------------

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.founding_pro_members'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%transition_status%'
    and conname <> 'founding_pro_members_transition_check';

  if v_conname is not null then
    execute format('alter table public.founding_pro_members drop constraint %I', v_conname);
  end if;
end $$;

alter table public.founding_pro_members
  add constraint founding_pro_members_transition_status_check
  check (transition_status in ('active', 'converted_to_pro', 'expired_to_free', 'transitioned'));

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.founding_pro_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%event_type%';

  if v_conname is not null then
    execute format('alter table public.founding_pro_events drop constraint %I', v_conname);
  end if;
end $$;

alter table public.founding_pro_events
  add constraint founding_pro_events_event_type_check
  check (event_type in (
    'application_submitted',
    'application_approved',
    'application_rejected',
    'application_withdrawn',
    'invitation_issued',
    'invitation_accepted',
    'member_enrolled',
    'member_grandfathered',
    'transition_completed',
    'converted_to_pro',
    'expired_to_free',
    'admin_action'
  ));

-- ---------------------------------------------------------------------
-- 3. expire_founding_pro_members() — the expiry sweep.
-- ---------------------------------------------------------------------

create or replace function public.expire_founding_pro_members()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_free_plan_id uuid;
  v_pro_plan_id uuid;
  v_founding_plan_id uuid;
  v_member record;
  v_current_plan_id uuid;
  v_expired_count int := 0;
  v_converted_count int := 0;
  v_deferred_count int := 0;
begin
  select id into v_free_plan_id from public.plans where code = 'free';
  select id into v_pro_plan_id from public.plans where code = 'pro';
  select id into v_founding_plan_id from public.plans where code = 'founding_pro';

  if v_free_plan_id is null or v_founding_plan_id is null then
    raise exception 'expire_founding_pro_members: required plan rows (free/founding_pro) are not configured';
  end if;

  for v_member in
    select m.id, m.user_id
    from public.founding_pro_members m
    where m.transition_status = 'active'
      and m.founding_expires_at <= now()
    order by m.id
    for update of m skip locked
  loop
    select upa.plan_id into v_current_plan_id
    from public.user_plan_assignments upa
    where upa.user_id = v_member.user_id and upa.active = true
    limit 1;

    if v_current_plan_id is not distinct from v_founding_plan_id then
      -- Still on Founding Pro past its term: deactivate it, activate
      -- Free. Same deactivate-old/insert-new pattern used everywhere
      -- else in this codebase (admin_change_user_plan,
      -- apply_subscription_event, founding_pro_enroll_member_core).
      update public.user_plan_assignments
      set active = false, ends_at = now()
      where user_id = v_member.user_id and active = true;

      insert into public.user_plan_assignments (user_id, plan_id, active)
      values (v_member.user_id, v_free_plan_id, true);

      update public.founding_pro_members
      set transition_status = 'expired_to_free', transitioned_at = now()
      where id = v_member.id;

      insert into public.founding_pro_events (event_type, member_id, target_user_id, metadata)
      values (
        'expired_to_free',
        v_member.id,
        v_member.user_id,
        jsonb_build_object('reason', 'term_expired', 'processed_at', now())
      );

      v_expired_count := v_expired_count + 1;

    elsif v_pro_plan_id is not null and v_current_plan_id is not distinct from v_pro_plan_id then
      -- Already converted to normal Pro (e.g. the apply_subscription_event
      -- bookkeeping already ran, or is racing with this sweep) — no
      -- entitlement change needed, just reconcile the bookkeeping so the
      -- member record isn't left stuck at 'active' forever.
      update public.founding_pro_members
      set transition_status = 'converted_to_pro', transitioned_at = now()
      where id = v_member.id;

      insert into public.founding_pro_events (event_type, member_id, target_user_id, metadata)
      values (
        'converted_to_pro',
        v_member.id,
        v_member.user_id,
        jsonb_build_object('reason', 'detected_during_expiry_sweep', 'processed_at', now())
      );

      v_converted_count := v_converted_count + 1;

    else
      -- On some other active plan (or no active plan at all) because of
      -- an explicit administrator change, or a plan configuration this
      -- sweep doesn't otherwise recognize. Never overwrite that decision
      -- — record it and move on without touching user_plan_assignments.
      insert into public.founding_pro_events (event_type, member_id, target_user_id, metadata)
      values (
        'admin_action',
        v_member.id,
        v_member.user_id,
        jsonb_build_object(
          'reason', 'expiry_sweep_deferred_to_existing_plan_change',
          'current_plan_id', v_current_plan_id,
          'processed_at', now()
        )
      );

      v_deferred_count := v_deferred_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'outcome', 'processed',
    'expired_to_free', v_expired_count,
    'converted_to_pro', v_converted_count,
    'deferred_to_admin_change', v_deferred_count
  );
end;
$$;

-- Scheduler-only. No client grant of any kind — not even admin-gated,
-- since there is no legitimate reason for any authenticated session
-- (admin or otherwise) to trigger this directly; it is a maintenance
-- sweep, not a business operation.
revoke all on function public.expire_founding_pro_members() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. apply_subscription_event() — Founding Pro conversion bookkeeping
--    added at the end of the existing 'active'/'past_due' branch. Every
--    prior line is byte-for-byte unchanged from 0047.
-- ---------------------------------------------------------------------

create or replace function public.apply_subscription_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_provider_price_id text,
  p_plan_code text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_timestamp timestamptz,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_free_plan_id uuid;
  v_subscription_id uuid;
  v_existing_last_event_at timestamptz;
  v_founding_member_id uuid;
begin
  -- Idempotency: a redelivered event is a no-op, not an error.
  if exists (
    select 1 from public.subscription_events
    where provider = p_provider and provider_event_id = p_provider_event_id
  ) then
    return jsonb_build_object('outcome', 'duplicate_ignored');
  end if;

  select id into v_plan_id from public.plans where code = p_plan_code;
  if v_plan_id is null then
    insert into public.subscription_events (provider, provider_event_id, event_type, processing_status, raw_payload)
    values (p_provider, p_provider_event_id, p_event_type, 'failed', p_raw_payload);
    raise exception 'apply_subscription_event: unknown plan code %', p_plan_code;
  end if;

  insert into public.billing_customers (user_id, provider, provider_customer_id)
  values (p_user_id, p_provider, p_provider_customer_id)
  on conflict (user_id, provider) do update
    set provider_customer_id = excluded.provider_customer_id, updated_at = now();

  select id, last_event_at into v_subscription_id, v_existing_last_event_at
  from public.subscriptions
  where provider = p_provider and provider_subscription_id = p_provider_subscription_id;

  -- Out-of-order guard: an older event arriving late is recorded for
  -- audit but never applied over newer state.
  if v_subscription_id is not null and v_existing_last_event_at is not null
     and p_event_timestamp < v_existing_last_event_at then
    insert into public.subscription_events (provider, provider_event_id, event_type, processing_status, raw_payload, subscription_id)
    values (p_provider, p_provider_event_id, p_event_type, 'ignored_stale', p_raw_payload, v_subscription_id);
    return jsonb_build_object('outcome', 'stale_ignored', 'subscription_id', v_subscription_id);
  end if;

  insert into public.subscriptions (
    user_id, plan_id, provider, provider_subscription_id, provider_price_id, status,
    current_period_start, current_period_end, cancel_at_period_end, last_event_at
  )
  values (
    p_user_id, v_plan_id, p_provider, p_provider_subscription_id, p_provider_price_id, p_status,
    p_current_period_start, p_current_period_end, p_cancel_at_period_end, p_event_timestamp
  )
  on conflict (provider, provider_subscription_id) do update
    set plan_id = excluded.plan_id,
        status = excluded.status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end,
        last_event_at = excluded.last_event_at,
        updated_at = now()
  returning id into v_subscription_id;

  -- Reflect into user_plan_assignments using the exact existing
  -- deactivate-old/insert-new pattern admin_change_user_plan already
  -- uses — the entitlement mechanism itself is untouched.
  if p_status in ('active', 'past_due') then
    if not exists (
      select 1 from public.user_plan_assignments
      where user_id = p_user_id and active = true and plan_id = v_plan_id
    ) then
      update public.user_plan_assignments
      set active = false, ends_at = now()
      where user_id = p_user_id and active = true;

      insert into public.user_plan_assignments (user_id, plan_id, active)
      values (p_user_id, v_plan_id, true);
    end if;

    -- Founding Pro conversion bookkeeping (new). Only ever matches a
    -- user who is both converting to 'pro' AND currently has a live
    -- ('active') Founding Pro membership record — a no-op for every
    -- other subscription event. Uses the authoritative Pro-conversion
    -- signal (an applied, active-status Pesapal subscription event for
    -- the 'pro' plan code) rather than inferring conversion merely from
    -- the user "currently having Pro" some other way.
    if p_plan_code = 'pro' then
      update public.founding_pro_members
      set transition_status = 'converted_to_pro', transitioned_at = now()
      where user_id = p_user_id and transition_status = 'active'
      returning id into v_founding_member_id;

      if v_founding_member_id is not null then
        insert into public.founding_pro_events (event_type, member_id, actor_user_id, target_user_id, metadata)
        values (
          'converted_to_pro',
          v_founding_member_id,
          p_user_id,
          p_user_id,
          jsonb_build_object('source', 'apply_subscription_event', 'provider', p_provider, 'provider_subscription_id', p_provider_subscription_id)
        );
      end if;
    end if;
  elsif p_status in ('cancelled', 'expired') then
    select id into v_free_plan_id from public.plans where code = 'free';
    if v_free_plan_id is not null and not exists (
      select 1 from public.user_plan_assignments
      where user_id = p_user_id and active = true and plan_id = v_free_plan_id
    ) then
      update public.user_plan_assignments
      set active = false, ends_at = now()
      where user_id = p_user_id and active = true;

      insert into public.user_plan_assignments (user_id, plan_id, active)
      values (p_user_id, v_free_plan_id, true);
    end if;
  end if;
  -- cancel_at_period_end = true while status is still 'active': access
  -- continues at the current (already-assigned) plan — no assignment
  -- change until a later event actually flips status to
  -- cancelled/expired at period end.

  insert into public.subscription_events (provider, provider_event_id, event_type, processing_status, raw_payload, subscription_id)
  values (p_provider, p_provider_event_id, p_event_type, 'processed', p_raw_payload, v_subscription_id);

  return jsonb_build_object('outcome', 'applied', 'subscription_id', v_subscription_id, 'plan_id', v_plan_id);
end;
$$;

revoke all on function public.apply_subscription_event(
  text, text, text, uuid, text, text, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, jsonb
) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Scheduling — pg_cron, daily at 03:00 UTC (off-peak), deterministic
--    job name so re-running this migration reschedules the same job
--    (cron.schedule upserts by job name) rather than accumulating
--    duplicate jobs.
--
--    If pg_cron cannot be enabled in the target project (e.g. the
--    extension is not available/allow-listed for this Supabase project
--    tier), this section fails loudly at migration time rather than
--    silently skipping — surfacing the exact blocker instead of leaving
--    expire_founding_pro_members() permanently unscheduled with no
--    record of why.
-- ---------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'expire-founding-pro-members',
  '0 3 * * *',
  $$select public.expire_founding_pro_members();$$
);
