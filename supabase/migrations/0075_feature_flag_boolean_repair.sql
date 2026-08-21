-- ARRIYIA Commercial Readiness — feature:* boolean-flag repair.
--
-- LIVE-DATA FINDING (confirmed by direct inspection of uzshazetfkjkrdnxwjtl,
-- not a migration-history bug): every `feature:*` quota_key this repo's own
-- migrations seed as a boolean (0046, 0056, 0058, 0059, 0060, 0062, 0063,
-- 0064 — always `1`, checked by `has_feature()` as `coalesce(limit, 0) = 1`)
-- currently holds, in production, the SAME numeric value as its sibling
-- `<engine>_intelligence_operations` metered quota key instead of `1`:
--
--   pro:          feature:collaboration=100, feature:data_intelligence=250,
--                 feature:analysis_intelligence=250, feature:research_intelligence=250,
--                 feature:decision_intelligence=150, feature:planning_intelligence=150,
--                 feature:action_intelligence=100
--   founding_pro: feature:data_intelligence=250, feature:analysis_intelligence=500,
--                 feature:research_intelligence=250, feature:decision_intelligence=150,
--                 feature:planning_intelligence=150, feature:action_intelligence=100
--
-- (feature:pro_intelligence=1 and founding_pro's feature:collaboration=1
-- were NOT affected — only these seven rows were.) This is very likely an
-- admin_update_plan_quota edit that intended to raise the *_operations
-- ceiling but was applied to the feature:* row instead (the two key
-- families sit side by side in plan_quotas with only a naming
-- convention distinguishing them).
--
-- Real production impact, confirmed by reading supabase/functions/ai-chat/
-- index.ts (resolveQuotaKey, ~line 530): any `*_operations` quota_key
-- requires `has_feature()` to return true before the call is even metered;
-- `has_feature()` requires the resolved limit to equal exactly `1`. Every
-- one of the seven corrupted rows above therefore currently makes
-- has_feature() return false, and every real Pro/Founding Pro user calling
-- Data/Analysis/Research/Decision/Planning/Action Intelligence, or (for Pro)
-- inviting a workspace collaborator, receives a hard 403 "AI feature not
-- available for this plan" / "Collaboration requires a Pro plan" — a fully
-- paid, fully entitled capability rejected by a data bug, not a design or
-- migration-history gap. Confirmed via user_quota_overrides (no per-user
-- override masks this for any of the 3 currently-active Pro users) and via
-- resolve_effective_quota_limit/has_feature's own SQL (0041/0046), which
-- has never changed shape.
--
-- Fix: restore exactly these seven rows to `1`, their originally-migrated
-- and only-ever-correct value, touching no other plan_quotas row (the
-- *_operations metered keys, storage_bytes, ai_messages, and
-- max_active_collaborators/max_pending_invitations are all untouched —
-- this migration corrects the feature:* namespace only). Idempotent: the
-- `quota_limit <> 1` guard makes a re-run a no-op once fixed.

update public.plan_quotas pq
set quota_limit = 1
from public.plans p
where pq.plan_id = p.id
  and p.code in ('pro', 'founding_pro')
  and pq.quota_key in (
    'feature:collaboration',
    'feature:data_intelligence',
    'feature:analysis_intelligence',
    'feature:research_intelligence',
    'feature:decision_intelligence',
    'feature:planning_intelligence',
    'feature:action_intelligence'
  )
  and pq.quota_limit <> 1;
