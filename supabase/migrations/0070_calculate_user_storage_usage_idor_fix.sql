-- P1-2 (ARRIYIA Production Stabilization Roadmap) — IDOR fix for
-- calculate_user_storage_usage(p_user_id uuid).
--
-- Confirmed finding: this function (0046_feature_entitlements_and_-
-- storage_quota.sql) is SECURITY DEFINER, EXECUTE-granted to
-- `authenticated`, and never checked that the caller's own auth.uid()
-- matches the p_user_id argument — any authenticated user could pass an
-- arbitrary UUID and read that user's total storage byte count
-- (documents.file_size + assets.size_bytes), bypassing RLS on those
-- tables entirely (SECURITY DEFINER runs with the definer's privileges,
-- not the caller's).
--
-- Fix mirrors the exact self-or-admin pattern this codebase already
-- established for the sibling RPC resolve_effective_quota_limit
-- (0041_user_quota_overrides.sql) and inherited for free by has_feature
-- (0046, same file this function was originally defined in) — the one
-- function that omitted it. language switches from sql to plpgsql only
-- because a raise exception requires it; the aggregate calculation
-- itself is byte-for-byte unchanged from the original.
--
-- No application code, RLS policy, or other function changes — the sole
-- legitimate caller (useStorageUsage -> getStorageUsage) already only
-- ever passes the caller's own id, and the one other caller
-- (enforce_storage_quota()'s BEFORE INSERT trigger) always passes the
-- inserting row's own owner, which is auth.uid() in that same session —
-- both continue to work unchanged. See docs/production/ (P1-2 report)
-- for the full audit.

create or replace function public.calculate_user_storage_usage(p_user_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is distinct from p_user_id and not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return
    coalesce((select sum(file_size) from public.documents where user_id = p_user_id), 0) +
    coalesce((select sum(size_bytes) from public.assets where owner_id = p_user_id), 0);
end;
$$;

revoke execute on function public.calculate_user_storage_usage(uuid) from public, anon;
grant execute on function public.calculate_user_storage_usage(uuid) to authenticated;
