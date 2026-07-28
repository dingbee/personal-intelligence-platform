-- Phase 8C: automatic single-hop provider fallback. Both columns nullable
-- and only ever populated together: requested_provider is set whenever a
-- request went through the router's fallback path at all (even if the
-- first candidate succeeded, so "requested == provider" is distinguishable
-- from "no routing info recorded"); fallback_reason is set only on the row
-- where provider actually differs from requested_provider, i.e. the one
-- that succeeded after an earlier candidate failed.
alter table public.ai_requests
  add column requested_provider text,
  add column fallback_reason text;
