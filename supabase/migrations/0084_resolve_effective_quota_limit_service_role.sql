-- Google Drive import "document insert failed: Not authorized" (P0001) fix.
--
-- ROOT CAUSE: enforce_storage_quota() (0046, BEFORE INSERT trigger on
-- documents/assets) calls two functions to compute a user's storage
-- quota: resolve_effective_quota_limit() (0041) and
-- calculate_user_storage_usage() (0046, later hardened by 0070's IDOR
-- fix). BOTH have always required `auth.uid() = p_user_id OR
-- is_platform_admin()` — correct for their ORIGINAL purpose (a client, or
-- client-facing RPC, asking about a specific user's own quota/usage) but
-- wrong as an INTERNAL guard inside a trigger that must run for every
-- documents/assets insert regardless of which role performed it.
--
-- google-drive-import (supabase/functions/google-drive-import/index.ts)
-- authenticates its caller via their own forwarded JWT
-- (callerClient.auth.getUser()), then inserts the document using a
-- SEPARATE service-role client — the same pattern every Edge Function in
-- this codebase uses to reach tables/columns RLS would otherwise block a
-- plain client insert from populating (source/source_file_id/
-- source_metadata/imported_at have no direct client-write path). Under a
-- service-role Postgres session there is no JWT at all, so auth.uid() is
-- NULL — `NULL IS DISTINCT FROM <real user id>` is TRUE, so both guards
-- fired unconditionally for every service-role-driven documents insert,
-- regardless of how correctly the Edge Function had already verified the
-- caller. 0070's own header comment explicitly assumed "the inserting
-- row's own owner ... is auth.uid() in that same session" for the
-- trigger's call path — true for every insert that had existed until now
-- (all client-driven, under RLS), false for this one. This was always
-- latent (any future service-role document-creation path would hit the
-- same wall) but was only ever exercised once Google Drive import's own
-- token handoff started reaching this far in the pipeline.
--
-- FIX: both functions' authorization guards now also allow the case
-- where auth.uid() IS NULL — meaning there is no end-user JWT in this
-- Postgres session at all, which is only ever true for
-- `service_role`/`postgres` (neither function has ever been, and remains
-- not, granted to `anon` — see the unchanged grants below; `authenticated`
-- can never present with a NULL auth.uid(), since PostgREST only assigns
-- that role when a JWT with a `sub` claim was successfully verified). Both
-- of those roles already have full backend trust (service_role already
-- bypasses RLS entirely on every table in this schema), so allowing them
-- through here grants nothing they didn't already effectively have — it
-- only fixes an internal call this same codebase's own trigger makes on
-- their behalf. Every EXISTING caller (a real authenticated user checking
-- their own quota/usage, an admin checking someone else's, or a denied
-- cross-user client request) sees byte-identical behavior: auth.uid() is
-- never NULL for those requests, so the added clause never applies to
-- them.
--
-- The authenticated-user-is-the-source-of-truth guarantee this fix is
-- required to preserve is enforced one layer up, unchanged by this
-- migration: google-drive-import only ever sets `user_id: user.id` from
-- its own server-verified `callerClient.auth.getUser()` result — never a
-- client-supplied value — exactly like every other Edge Function in this
-- codebase that writes rows under a service-role client.

create or replace function public.resolve_effective_quota_limit(p_user_id uuid, p_quota_key text)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_plan_limit bigint;
  v_override bigint;
begin
  if auth.uid() is not null and auth.uid() is distinct from p_user_id and not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select upa.plan_id into v_plan_id
  from public.user_plan_assignments upa
  where upa.user_id = p_user_id and upa.active = true
  limit 1;

  if v_plan_id is null then
    return null;
  end if;

  select pq.quota_limit into v_plan_limit
  from public.plan_quotas pq
  where pq.plan_id = v_plan_id and pq.quota_key = p_quota_key;

  select uqo.quota_limit into v_override
  from public.user_quota_overrides uqo
  where uqo.user_id = p_user_id and uqo.quota_key = p_quota_key;

  return coalesce(v_override, v_plan_limit);
end;
$$;

create or replace function public.calculate_user_storage_usage(p_user_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() is distinct from p_user_id and not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return
    coalesce((select sum(file_size) from public.documents where user_id = p_user_id), 0) +
    coalesce((select sum(size_bytes) from public.assets where owner_id = p_user_id), 0);
end;
$$;

-- Grants unchanged from 0041/0070 — still never granted to anon/public.
-- Restated here only so this migration remains a complete,
-- self-contained create-or-replace of each function, not a silent grant
-- change.
revoke execute on function public.resolve_effective_quota_limit(uuid, text) from public;
revoke execute on function public.resolve_effective_quota_limit(uuid, text) from anon;
grant execute on function public.resolve_effective_quota_limit(uuid, text) to authenticated;

revoke execute on function public.calculate_user_storage_usage(uuid) from public;
revoke execute on function public.calculate_user_storage_usage(uuid) from anon;
grant execute on function public.calculate_user_storage_usage(uuid) to authenticated;
