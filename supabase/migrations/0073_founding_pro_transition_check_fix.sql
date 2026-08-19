-- ARRIYIA V1 — Founding Pro Expiry: transition-check constraint fix.
--
-- UAT FINDING (caught live, inside a rolled-back test transaction, zero
-- production impact): 0072_founding_pro_expiry.sql widened
-- founding_pro_members_transition_status_check (the allowed VALUES list
-- for transition_status) to include 'converted_to_pro'/'expired_to_free',
-- but missed a second, separate, pre-existing constraint on the same
-- table — founding_pro_members_transition_check (0052) — which couples
-- transition_status to transitioned_at and only ever permitted exactly
-- two combinations: ('active', NULL) or ('transitioned', NOT NULL).
-- Both constraints are ANDed together by Postgres, so
-- expire_founding_pro_members()/apply_subscription_event()'s new writes
-- of ('expired_to_free', now()) or ('converted_to_pro', now()) violated
-- this second constraint and would have failed the first time either
-- function actually processed a real row (there are currently zero live
-- founding_pro_members rows, so no real transition was ever attempted or
-- lost — this was caught before any real member existed to hit it).
--
-- Fix: widen founding_pro_members_transition_check's "non-active" branch
-- to accept the same three non-active values transition_status_check
-- already allows, preserving the exact same invariant shape (active
-- requires transitioned_at IS NULL; anything else requires it NOT NULL).

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.founding_pro_members'::regclass
    and contype = 'c'
    and conname = 'founding_pro_members_transition_check';

  if v_conname is not null then
    execute format('alter table public.founding_pro_members drop constraint %I', v_conname);
  end if;
end $$;

alter table public.founding_pro_members
  add constraint founding_pro_members_transition_check
  check (
    (transition_status = 'active' and transitioned_at is null)
    or (transition_status in ('converted_to_pro', 'expired_to_free', 'transitioned') and transitioned_at is not null)
  );
