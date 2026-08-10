-- Phase 4 Commercial Architecture — close the anon_security_definer_-
-- function_executable advisory finding raised against enforce_storage_-
-- quota() immediately after 0046 shipped it.
--
-- enforce_storage_quota() is a trigger function (returns trigger) with
-- no legitimate direct-call path — a bare RPC call errors outside
-- trigger context, and Postgres invokes it via the trigger mechanism
-- regardless of any EXECUTE grant — exactly the same shape as
-- assign_default_plan(), reconciled the same way in
-- 0044_commercial_schema_reconciliation.sql. Revoking the latent
-- anon/authenticated grants here applies the identical discipline.

revoke execute on function public.enforce_storage_quota() from public, anon, authenticated;
