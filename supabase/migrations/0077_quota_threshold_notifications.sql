-- ARRIYIA Commercial Readiness — Usage Intelligence: quota threshold
-- notifications.
--
-- Wires the EXISTING quota-consumption write path (consume_quota, 0041) to
-- the EXISTING notification system (notifications table + bell, 0068) —
-- no second notification system, no new client-write policy, no mutation
-- of resolve_effective_quota_limit (the hot-path read function stays
-- untouched; this migration only extends the write-side consume_quota
-- already runs for every ai_messages/*_intelligence_operations call).
--
-- consume_quota() is called exclusively with 'ai_messages' or one of the
-- six '<engine>_intelligence_operations' keys today (confirmed by reading
-- supabase/functions/ai-chat/index.ts's resolveQuotaKey/consume_quota call
-- site and src/modules/ai/orchestration/AIService.ts) — the allow-list
-- below is defense-in-depth in case consume_quota is ever reused for an
-- unrelated key, not a guess about current callers.
--
-- Dedup model: one row per (user, quota_key, period_start, threshold) in
-- the new quota_threshold_notifications table. A NEW period_start (the
-- monthly rollover consume_quota already computes) is a different row —
-- natural reset, no explicit cleanup needed. Only the single highest
-- newly-crossed threshold fires per call, so a quota whose limit is small
-- enough to jump multiple thresholds in one increment (e.g. limit=1)
-- produces exactly one notification, not four.

-- ---------------------------------------------------------------------
-- 1. quota_threshold_notifications — dedup ledger. Mirrors user_quota_-
--    overrides' RLS shape exactly (0041): the user may read their own
--    rows; the only write path is consume_quota (SECURITY DEFINER) below.
-- ---------------------------------------------------------------------

create table public.quota_threshold_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quota_key text not null,
  period_start timestamptz not null,
  threshold smallint not null,
  created_at timestamptz not null default now(),
  constraint quota_threshold_notifications_unique unique (user_id, quota_key, period_start, threshold)
);

alter table public.quota_threshold_notifications enable row level security;

create policy "Users view their own quota threshold notifications"
  on public.quota_threshold_notifications for select
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. consume_quota() — re-declared with CREATE OR REPLACE, preserving the
--    exact 0041 signature/return shape and every existing line of
--    consumption logic verbatim (atomic upsert-increment, current-period
--    scoping, auth.uid()-resolved caller, null-limit early return). Adds
--    exactly one new step at the end, before the existing final
--    `return query`: on a newly-crossed 50/75/90/100% threshold for an
--    allow-listed quota_key, insert a dedup row and (only on a fresh
--    insert, i.e. not already notified this period) a notification.
--
--    Payload carries the raw quota_key/usage/limit — this is internal
--    data for the client to map to a human label, never rendered
--    directly; NotificationBell.tsx's describeNotification() is
--    responsible for translating it to plan-agnostic, non-alarming,
--    single-capability-scoped copy (never a raw key, never implying every
--    capability is exhausted) for the 'quota_threshold' notification type.
-- ---------------------------------------------------------------------

create or replace function public.consume_quota(p_quota_key text)
returns table (usage_count bigint, quota_limit bigint, allowed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit bigint;
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end timestamptz := date_trunc('month', now()) + interval '1 month';
  v_count bigint;
  v_percent numeric;
  v_threshold smallint;
  v_dedup_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_limit := public.resolve_effective_quota_limit(v_user_id, p_quota_key);

  if v_limit is null then
    return query select 0::bigint, 0::bigint, false;
    return;
  end if;

  insert into public.quota_usage (user_id, quota_key, usage_count, period_start, period_end)
  values (v_user_id, p_quota_key, 1, v_period_start, v_period_end)
  on conflict (user_id, quota_key, period_start)
  do update set usage_count = quota_usage.usage_count + 1, updated_at = now()
  returning quota_usage.usage_count into v_count;

  if v_limit > 0 and p_quota_key in (
    'ai_messages',
    'data_intelligence_operations',
    'analysis_intelligence_operations',
    'research_intelligence_operations',
    'decision_intelligence_operations',
    'planning_intelligence_operations',
    'action_intelligence_operations'
  ) then
    v_percent := (v_count::numeric / v_limit::numeric) * 100;

    foreach v_threshold in array array[100, 90, 75, 50]::smallint[] loop
      if v_percent >= v_threshold then
        insert into public.quota_threshold_notifications (user_id, quota_key, period_start, threshold)
        values (v_user_id, p_quota_key, v_period_start, v_threshold)
        on conflict (user_id, quota_key, period_start, threshold) do nothing
        returning id into v_dedup_id;

        if v_dedup_id is not null then
          insert into public.notifications (recipient_user_id, type, payload)
          values (
            v_user_id,
            'quota_threshold',
            jsonb_build_object(
              'quota_key', p_quota_key,
              'threshold', v_threshold,
              'usage_count', v_count,
              'quota_limit', v_limit,
              'period_end', v_period_end
            )
          );
        end if;

        exit;
      end if;
    end loop;
  end if;

  return query select v_count, v_limit, (v_count <= v_limit);
end;
$$;

revoke execute on function public.consume_quota(text) from public;
revoke execute on function public.consume_quota(text) from anon;
grant execute on function public.consume_quota(text) to authenticated;
