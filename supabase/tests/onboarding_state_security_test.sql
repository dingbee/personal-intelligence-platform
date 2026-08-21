-- ARRIYIA — First-Login Welcome Experience security test
-- (0079_onboarding_state.sql).
--
-- Users reused from the existing test suite's vetted, safe-to-mutate-
-- within-a-rollback set:
--   313866d5-4ab7-4d65-bda9-67b9bd668f2d (drhully@outlook.com)
--   9e733cfc-e6ae-45e6-8b14-dc64247a9cb2 (hello@nolmark.co)

-- ---------------------------------------------------------------------
-- 1. Every pre-existing profile (i.e. every profile in this live
--    database, since this migration has already run against it) has a
--    non-null onboarding_completed_at — the backfill did its job, so no
--    established user is incorrectly treated as new.
-- ---------------------------------------------------------------------

do $$
declare
  v_unbackfilled_count integer;
begin
  select count(*) into v_unbackfilled_count
  from public.profiles
  where onboarding_completed_at is null
    and created_at < now() - interval '1 minute';

  if v_unbackfilled_count <> 0 then
    raise exception 'ONBOARDING STATE TEST FAILED (1): % pre-existing profiles still have a null onboarding_completed_at', v_unbackfilled_count;
  end if;

  raise notice 'ONBOARDING STATE TEST (1) PASSED: every pre-existing profile was backfilled';
end;
$$;

-- ---------------------------------------------------------------------
-- 2. A user can mark their own onboarding complete via the existing
--    self-update policy (the same path updateProfile()/
--    updateDefaultChatProvider() already use — no new policy or RPC was
--    added, and this proves that decision was correct).
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_before timestamptz;
  v_after timestamptz;
begin
  select onboarding_completed_at into v_before from public.profiles where id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d';

  update public.profiles set onboarding_completed_at = now() where id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d';

  select onboarding_completed_at into v_after from public.profiles where id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d';

  if v_after is null or v_after = v_before then
    raise exception 'ONBOARDING STATE TEST FAILED (2): self-update of onboarding_completed_at did not take effect';
  end if;

  raise notice 'ONBOARDING STATE TEST (2) PASSED: a user can mark their own onboarding complete';
end;
$$;

rollback;

-- ---------------------------------------------------------------------
-- 3. A user cannot mark a DIFFERENT user's onboarding complete (the
--    existing self-only RLS update policy, unmodified, still scopes this
--    exactly like every other profiles column).
-- ---------------------------------------------------------------------

begin;
set local "request.jwt.claims" = '{"sub":"9e733cfc-e6ae-45e6-8b14-dc64247a9cb2","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_updated integer;
  v_target_before timestamptz;
  v_target_after timestamptz;
begin
  select onboarding_completed_at into v_target_before from public.profiles where id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d';

  update public.profiles set onboarding_completed_at = now() where id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d';
  get diagnostics v_updated = row_count;

  select onboarding_completed_at into v_target_after from public.profiles where id = '313866d5-4ab7-4d65-bda9-67b9bd668f2d';

  if v_updated <> 0 or v_target_after is distinct from v_target_before then
    raise exception 'ONBOARDING STATE TEST FAILED (3): a user updated another user''s onboarding_completed_at';
  end if;

  raise notice 'ONBOARDING STATE TEST (3) PASSED: a user cannot mark another user''s onboarding complete';
end;
$$;

rollback;
