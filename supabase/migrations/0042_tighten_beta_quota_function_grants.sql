-- Migration-history reconciliation only.
--
-- This statement was already applied directly to production as remote
-- migration version 20260807073050 ("tighten_beta_quota_function_grants"),
-- sitting chronologically between 0034_beta_invite_quota_repair.sql and
-- 0035_platform_admin_foundation.sql, but no corresponding numbered file
-- was ever committed to this repo — local migration history skipped
-- straight from 0034 to 0035. This file closes that gap so local history
-- matches what is live; it does not perform a new change.
--
-- Live grants were re-verified before adding this file (2026-08-10):
-- consume_quota is PUBLIC:false / authenticated:true / anon:false, and
-- enforce_beta_invite_gate is PUBLIC:false, exactly as this statement
-- would produce. Production behavior is unchanged by adding this file —
-- the revoke/grant calls below are idempotent (re-running them against
-- the already-tightened live grants is a no-op), so this is safe to keep
-- in history even though it must not be re-applied as a "new" migration.
--
-- New functions inherit Postgres's default EXECUTE-to-PUBLIC grant unless
-- revoked, which is why the advisor flags both as anon-callable despite
-- the explicit `grant ... to authenticated` on consume_quota already
-- applied. enforce_beta_invite_gate is a trigger function only — nobody
-- should ever invoke it directly as an RPC (NEW/OLD aren't defined
-- outside trigger context, so a direct call would just error, but it
-- shouldn't be reachable at all). is_beta_invited is deliberately left
-- alone: it must stay anon-callable since the client checks it before
-- the user is authenticated (pre-signup).

revoke execute on function public.enforce_beta_invite_gate() from public;
revoke execute on function public.consume_quota(text) from public;
grant execute on function public.consume_quota(text) to authenticated;
