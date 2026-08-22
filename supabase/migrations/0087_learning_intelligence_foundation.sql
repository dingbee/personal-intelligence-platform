-- ARRIYIA — I8 Learning / Adaptive Intelligence.
--
-- Closes the loop the Intelligence Ledger (0066_intelligence_ledger.sql)
-- already reserved space for: that migration's own header explicitly
-- lists "outcome evaluation/learning" as NOT YET BUILT, and
-- intelligence_records already carries expected_outcome/actual_outcome/
-- outcome_evaluated_at columns "reserved for future outcome tracking
-- (Capability 'Learn')... not populated or evaluated by this migration or
-- any code it ships with." This migration is that Capability — it does
-- NOT duplicate the ledger (intelligence_records/intelligence_journeys are
-- unmodified in shape; only the reserved actual_outcome/
-- outcome_evaluated_at columns are now genuinely written to, via a new
-- RPC), does NOT duplicate ai_memory (a distinct, pre-existing chat-
-- personalization system this migration never touches), and does NOT
-- duplicate execution_foundation (an 'execution' intelligence_records row
-- already points at its own execution_requests row; this migration reads
-- that row's own already-computed I7 verification result to auto-derive
-- an execution's outcome, never re-implementing verification itself).
--
-- ARCHITECTURE — three new tables, purely additive:
--
--   intelligence_outcome_evaluations — ONE row per evaluated outcome
--   (expected vs actual) for an existing intelligence_records row.
--   Append-only: a later evaluation of the SAME record (e.g. a user's
--   feedback arriving after an automatic system-observed evaluation)
--   never overwrites or deletes an earlier one — both are preserved
--   distinctly, exactly matching I8's own required "system outcome:
--   SUCCESS, user feedback: 'not useful' — stored separately" scenario.
--   `source` distinguishes 'system_observed' (deterministically derived
--   from a real, already-computed fact — currently only I7's own
--   verification result) from 'user_feedback' (a human explicitly
--   recording what happened) — never conflated, per I8.9.
--
--   intelligence_learning_signals — a durable, evidence-grounded pattern:
--   "actions/decisions/plans matching pattern_key tend to {match/miss}
--   their expected outcome." `pattern_key` is a deterministic, honest
--   classification computed application-side per record_type (never
--   free text an LLM invented) — see recordIntelligenceOutcome.ts's own
--   doc comment for exactly how each record_type derives one. `strength`
--   is a pure function of `evidence_count` (1 -> weak, 2-3 -> moderate,
--   4+ -> strong — see record_intelligence_outcome() below), never a
--   fabricated statistical claim. `status` starts 'proposed' (a single
--   observation — not yet trusted enough to influence anything) and only
--   becomes 'active' once evidence_count reaches 2 (I8.6's own "do NOT
--   allow one event to create STRONG learning," generalized: one event
--   cannot even leave 'proposed'). A genuinely CONTRADICTING signal (same
--   pattern_key, opposite direction) is never overwritten or deleted —
--   the existing one is marked 'contested' and a new, separate signal is
--   created for the new direction, linked via `contradicts_signal_id`
--   (I8.7/I8.8: full history preserved, nothing silently overwritten).
--   'revoked' is the only user-controllable transition (I8.21/I8.22),
--   via revoke_learning_signal() below.
--
--   intelligence_learning_evidence — the append-only join between a
--   signal and every evaluation that ever contributed to it (or
--   contested it) — the audit trail I8.20 asks the Ledger to support,
--   reusing intelligence_records/intelligence_outcome_evaluations as the
--   evidence rather than inventing a second ledger.
--
-- ENTITLEMENT — a dedicated feature:learning_intelligence key, seeded for
-- pro/founding_pro, following 0064_action_intelligence_entitlement.sql's
-- exact precedent. No metered *_operations quota key: recording an
-- outcome or reconciling a learning signal makes zero AI calls (pure
-- deterministic SQL), so there is nothing to meter and no double-
-- consumption risk to guard against — mirroring I7's own conclusion that
-- Execution Foundation needed no separate operation-budget key.
--
-- SECURITY MODEL — mirrors 0065_execution_foundation.sql's own precedent
-- exactly: RLS SELECT-only, scoped to `auth.uid() = user_id` (owner-only,
-- deliberately NOT workspace-shareable like intelligence_records/
-- intelligence_journeys are — a user's own learned patterns are not
-- automatically surfaced to workspace collaborators; see
-- recordIntelligenceOutcome.ts's own doc comment). Zero insert/update/
-- delete grants to `authenticated` on all three tables — every mutation
-- goes exclusively through the two SECURITY DEFINER RPCs below, each of
-- which sets user_id from auth.uid() server-side (never client-supplied)
-- and verifies the referenced intelligence_records row actually belongs
-- to the caller before doing anything else.

create type public.outcome_evaluation_source as enum ('system_observed', 'user_feedback');
create type public.outcome_comparison_result as enum ('match', 'partial_match', 'miss', 'contradiction', 'unknown');
create type public.learning_signal_direction as enum ('positive', 'negative');
create type public.learning_signal_strength as enum ('weak', 'moderate', 'strong');
create type public.learning_signal_status as enum ('proposed', 'active', 'contested', 'revoked');

create table public.intelligence_outcome_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  record_id uuid not null references public.intelligence_records (id) on delete cascade,
  source public.outcome_evaluation_source not null,
  expected_outcome text not null,
  actual_outcome text not null,
  comparison_result public.outcome_comparison_result not null,
  -- I8.3 — execution success and outcome success are distinct facts.
  -- Null when the record type has no separate "did it run at all" fact
  -- (e.g. a decision/plan being evaluated directly, not via an
  -- execution) — never defaulted to true/false when genuinely unknown.
  execution_succeeded boolean,
  -- Free-text human commentary — populated only for source = 'user_feedback'.
  feedback_note text,
  pattern_key text not null,
  created_at timestamptz not null default now()
);

create table public.intelligence_learning_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  record_type public.intelligence_record_type not null,
  pattern_key text not null,
  direction public.learning_signal_direction not null,
  statement text not null,
  strength public.learning_signal_strength not null default 'weak',
  status public.learning_signal_status not null default 'proposed',
  evidence_count int not null default 1,
  contradicts_signal_id uuid references public.intelligence_learning_signals (id) on delete set null,
  revoked_reason text,
  revoked_at timestamptz,
  first_evidence_at timestamptz not null default now(),
  last_evidence_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.intelligence_learning_evidence (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.intelligence_learning_signals (id) on delete cascade,
  evaluation_id uuid not null references public.intelligence_outcome_evaluations (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (signal_id, evaluation_id)
);

create index intelligence_outcome_evaluations_user_id_idx on public.intelligence_outcome_evaluations (user_id);
create index intelligence_outcome_evaluations_record_id_idx on public.intelligence_outcome_evaluations (record_id);
create index intelligence_outcome_evaluations_pattern_key_idx on public.intelligence_outcome_evaluations (pattern_key);

create index intelligence_learning_signals_user_id_idx on public.intelligence_learning_signals (user_id);
create index intelligence_learning_signals_reconcile_idx on public.intelligence_learning_signals (user_id, pattern_key, direction, status);
create index intelligence_learning_signals_contradicts_idx on public.intelligence_learning_signals (contradicts_signal_id) where contradicts_signal_id is not null;

create index intelligence_learning_evidence_signal_id_idx on public.intelligence_learning_evidence (signal_id);
create index intelligence_learning_evidence_evaluation_id_idx on public.intelligence_learning_evidence (evaluation_id);

create trigger set_intelligence_learning_signals_updated_at
  before update on public.intelligence_learning_signals
  for each row execute function public.set_updated_at();

alter table public.intelligence_outcome_evaluations enable row level security;
alter table public.intelligence_learning_signals enable row level security;
alter table public.intelligence_learning_evidence enable row level security;

create policy "Users can view their own outcome evaluations"
  on public.intelligence_outcome_evaluations for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own learning signals"
  on public.intelligence_learning_signals for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view evidence for their own learning signals"
  on public.intelligence_learning_evidence for select
  to authenticated
  using (exists (select 1 from public.intelligence_learning_signals ls where ls.id = intelligence_learning_evidence.signal_id and ls.user_id = (select auth.uid())));

revoke insert, update, delete, truncate on public.intelligence_outcome_evaluations from authenticated;
revoke all on public.intelligence_outcome_evaluations from anon;
revoke insert, update, delete, truncate on public.intelligence_learning_signals from authenticated;
revoke all on public.intelligence_learning_signals from anon;
revoke insert, update, delete, truncate on public.intelligence_learning_evidence from authenticated;
revoke all on public.intelligence_learning_evidence from anon;

-- ---------------------------------------------------------------------
-- record_intelligence_outcome() — the only way an outcome evaluation can
-- be recorded, a learning signal reinforced/created/contested, or the
-- ledger's own reserved actual_outcome/outcome_evaluated_at columns
-- populated. Gated by feature:learning_intelligence, same has_feature()
-- primitive every other engine uses. Ownership of the target
-- intelligence_records row is re-verified here (not merely relying on
-- its own RLS SELECT policy), matching every other engine's own RPC
-- discipline in this codebase.
-- ---------------------------------------------------------------------

create or replace function public.record_intelligence_outcome(
  p_record_id uuid,
  p_source text,
  p_expected_outcome text,
  p_actual_outcome text,
  p_comparison_result text,
  p_pattern_key text,
  p_execution_succeeded boolean default null,
  p_feedback_note text default null
)
returns public.intelligence_outcome_evaluations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.intelligence_records;
  v_evaluation public.intelligence_outcome_evaluations;
  v_direction public.learning_signal_direction;
  v_matching_signal public.intelligence_learning_signals;
  v_opposing_signal public.intelligence_learning_signals;
  v_new_signal public.intelligence_learning_signals;
  v_new_evidence_count int;
  v_new_strength public.learning_signal_strength;
  v_statement text;
begin
  if not public.has_feature((select auth.uid()), 'learning_intelligence') then
    raise exception 'record_intelligence_outcome: learning intelligence requires an upgraded plan';
  end if;

  select * into v_record from public.intelligence_records where id = p_record_id and user_id = (select auth.uid());
  if not FOUND then
    raise exception 'record_intelligence_outcome: record not found or not owned by caller';
  end if;

  if p_source not in ('system_observed', 'user_feedback') then
    raise exception 'record_intelligence_outcome: invalid source %', p_source;
  end if;
  if p_comparison_result not in ('match', 'partial_match', 'miss', 'contradiction', 'unknown') then
    raise exception 'record_intelligence_outcome: invalid comparison_result %', p_comparison_result;
  end if;
  if p_expected_outcome is null or length(trim(p_expected_outcome)) = 0 then
    raise exception 'record_intelligence_outcome: expected_outcome is required';
  end if;
  if p_actual_outcome is null or length(trim(p_actual_outcome)) = 0 then
    raise exception 'record_intelligence_outcome: actual_outcome is required';
  end if;
  if p_pattern_key is null or length(trim(p_pattern_key)) = 0 then
    raise exception 'record_intelligence_outcome: pattern_key is required';
  end if;

  insert into public.intelligence_outcome_evaluations (
    user_id, workspace_id, record_id, source, expected_outcome, actual_outcome, comparison_result, execution_succeeded, feedback_note, pattern_key
  ) values (
    (select auth.uid()), v_record.workspace_id, p_record_id, p_source::public.outcome_evaluation_source, p_expected_outcome, p_actual_outcome,
    p_comparison_result::public.outcome_comparison_result, p_execution_succeeded, p_feedback_note, p_pattern_key
  ) returning * into v_evaluation;

  -- The ledger's own single-slot "latest known outcome" cache (I8.1) —
  -- convenience display fields only. The full, non-destructive evaluation
  -- history (including this evaluation, and any earlier ones for the same
  -- record) remains intact in intelligence_outcome_evaluations above;
  -- nothing here deletes or mutates a prior evaluation row.
  update public.intelligence_records
  set actual_outcome = p_actual_outcome, outcome_evaluated_at = now()
  where id = p_record_id;

  -- I8.18 — an 'unknown' comparison (an unverified claim) must never
  -- create or reinforce a learning signal. The evaluation itself is still
  -- durably recorded above (an honest "we don't know" is worth keeping),
  -- it just never becomes evidence.
  if p_comparison_result = 'unknown' then
    return v_evaluation;
  end if;

  v_direction := case when p_comparison_result in ('match', 'partial_match') then 'positive' else 'negative' end;

  v_matching_signal := null;
  select * into v_matching_signal
  from public.intelligence_learning_signals
  where user_id = (select auth.uid()) and pattern_key = p_pattern_key and direction = v_direction and status in ('proposed', 'active')
  order by created_at desc
  limit 1;

  if FOUND then
    v_new_evidence_count := v_matching_signal.evidence_count + 1;
    v_new_strength := case when v_new_evidence_count >= 4 then 'strong' when v_new_evidence_count >= 2 then 'moderate' else 'weak' end;

    update public.intelligence_learning_signals
    set evidence_count = v_new_evidence_count,
        strength = v_new_strength,
        status = case when status = 'proposed' and v_new_evidence_count >= 2 then 'active' else status end,
        last_evidence_at = now(),
        updated_at = now()
    where id = v_matching_signal.id;

    insert into public.intelligence_learning_evidence (signal_id, evaluation_id) values (v_matching_signal.id, v_evaluation.id);
    return v_evaluation;
  end if;

  -- No reinforceable signal in this direction yet — check for a
  -- genuinely opposing one (I8.7): same pattern, opposite direction.
  v_opposing_signal := null;
  select * into v_opposing_signal
  from public.intelligence_learning_signals
  where user_id = (select auth.uid()) and pattern_key = p_pattern_key and direction <> v_direction and status in ('proposed', 'active')
  order by created_at desc
  limit 1;

  if FOUND then
    update public.intelligence_learning_signals
    set status = 'contested', updated_at = now()
    where id = v_opposing_signal.id;
  end if;

  v_statement := case
    when v_direction = 'positive' then format('Pattern "%s" tends to match its expected outcome.', p_pattern_key)
    else format('Pattern "%s" tends to miss or contradict its expected outcome.', p_pattern_key)
  end;

  insert into public.intelligence_learning_signals (
    user_id, workspace_id, record_type, pattern_key, direction, statement, strength, status, evidence_count,
    contradicts_signal_id, first_evidence_at, last_evidence_at
  ) values (
    (select auth.uid()), v_record.workspace_id, v_record.record_type, p_pattern_key, v_direction, v_statement, 'weak', 'proposed', 1,
    v_opposing_signal.id, now(), now()
  ) returning * into v_new_signal;

  insert into public.intelligence_learning_evidence (signal_id, evaluation_id) values (v_new_signal.id, v_evaluation.id);

  return v_evaluation;
end;
$$;

revoke all on function public.record_intelligence_outcome(uuid, text, text, text, text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.record_intelligence_outcome(uuid, text, text, text, text, text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- revoke_learning_signal() — I8.21's own user-control requirement: the
-- only mutation a user can apply directly to a learning signal, ever.
-- Terminal — a revoked signal cannot be un-revoked or re-reinforced; a
-- later matching evaluation instead starts a fresh 'proposed' signal
-- (see the reinforcement lookup above, which only matches
-- status in ('proposed','active')). Historical provenance (the evidence
-- trail, the revoked signal's own row) is never deleted.
-- ---------------------------------------------------------------------

create or replace function public.revoke_learning_signal(
  p_signal_id uuid,
  p_reason text default null
)
returns public.intelligence_learning_signals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signal public.intelligence_learning_signals;
begin
  select * into v_signal from public.intelligence_learning_signals where id = p_signal_id and user_id = (select auth.uid());
  if not FOUND then
    raise exception 'revoke_learning_signal: signal not found or not owned by caller';
  end if;
  if v_signal.status = 'revoked' then
    raise exception 'revoke_learning_signal: signal is already revoked';
  end if;

  update public.intelligence_learning_signals
  set status = 'revoked', revoked_reason = p_reason, revoked_at = now(), updated_at = now()
  where id = p_signal_id
  returning * into v_signal;

  return v_signal;
end;
$$;

revoke all on function public.revoke_learning_signal(uuid, text) from public, anon, authenticated;
grant execute on function public.revoke_learning_signal(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Entitlement — feature:learning_intelligence, seeded for pro/
-- founding_pro only, following 0064_action_intelligence_entitlement.sql's
-- exact precedent. No metered operations quota key — see migration
-- header.
-- ---------------------------------------------------------------------

insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'feature:learning_intelligence', 1, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;
