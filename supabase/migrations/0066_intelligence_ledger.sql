-- ARRIYIA — Intelligence Ledger. The durable, provenance-grounded record
-- of what the six intelligence engines (Data/Analysis/Research/Planning/
-- Decision/Action) and Execution Foundation actually produced, replacing
-- nothing: every existing engine, the provenance adapters under
-- src/shared/provenance/, ai_memory, workspace_objectives, and
-- execution_requests/authorizations/attempts/audit_events are all
-- unmodified. This migration is purely additive: two new tables, two new
-- SECURITY DEFINER RPCs.
--
-- ARCHITECTURE (approved design, see docs discussion preceding this
-- migration): ONE canonical intelligence_records table, not one per
-- engine — record_type is a discriminator, structured_output is a jsonb
-- payload holding each engine's own already-typed result verbatim,
-- mirroring how notes.generation_metadata already holds arbitrary
-- structured content behind an artifactKind discriminator. Execution
-- Foundation's own four tables are NOT duplicated here — an
-- intelligence_records row for an execution event points AT the real
-- execution_requests row via execution_request_id rather than
-- re-storing authorization/attempt/audit detail.
--
-- intelligence_journeys is a minimal grouping anchor ("a coherent piece
-- of intelligence work", e.g. "Should Mtoni expand its room inventory?")
-- — optionally pointing at a workspace_objectives row via objective_id,
-- never the reverse: one objective may have many journeys over time, so
-- workspace_objectives itself is NOT modified by this migration.
--
-- LINEAGE: journey_id groups loosely ("these all belong to the same
-- thread"); parent_record_id links precisely ("this Decision came from
-- THIS Plan") — the same two-field model Research/Analysis Intelligence
-- already use internally for their own step chains (see
-- runAnalysisInvestigation.ts's `triggeredBy: priorStep?.id ?? null`),
-- just made durable. No relationship table: a nullable self-referencing
-- foreign key is the whole model, per the approved design's own
-- instruction not to add more structure than implementation evidence
-- requires.
--
-- SECURITY MODEL (mirrors 0065_execution_foundation.sql's own precedent
-- exactly): both tables get an owner-or-workspace-viewer SELECT policy
-- (matching workspace_objectives' shareable-bucket treatment, since
-- Ledger history is meant to be workspace-visible, not private like
-- ai_memory) and ZERO insert/update/delete grants to `authenticated` —
-- every write goes through a SECURITY DEFINER RPC that sets user_id from
-- auth.uid() server-side (never client-supplied), verifies any
-- referenced journey/parent-record/execution-request actually belongs to
-- the caller, and verifies workspace membership before tagging a record
-- with a workspace_id — a client cannot forge a ledger event, attach it
-- to someone else's journey, or use objective_id/workspace_id to escape
-- workspace boundaries.
--
-- PERSISTENCE DISCIPLINE: structured_output stores only the
-- already-parsed, already-validated result object each engine already
-- returns to its own caller today (Plan/Decision/ActionSet/
-- AnalyticalResult/AnalysisInvestigation/ResearchInvestigation, or an
-- Execution's own already-fetched request/attempt bundle) — never a raw
-- system prompt, never a raw unparsed model completion. provenance
-- stores exactly what the existing src/shared/provenance/ adapters
-- compute, unmodified, called once at write time while the engine's
-- result is still in memory — this migration does not create a second
-- provenance system.

create type public.intelligence_record_type as enum ('data', 'analysis', 'research', 'planning', 'decision', 'action', 'execution');
create type public.intelligence_record_status as enum ('created', 'running', 'completed', 'failed', 'superseded', 'archived');

create table public.intelligence_journeys (
  id uuid primary key default gen_random_uuid(),
  -- set null, not cascade: a shared workspace can be deleted (e.g. its
  -- owner deletes their account) without destroying a journey that
  -- belongs to a DIFFERENT user who was only a collaborator on it — the
  -- dominant convention across this schema (workspaces/notes/documents/
  -- assets/collections/...) and the exact guarantee
  -- supabase/functions/delete-account/index.ts documents ("nothing
  -- belonging to another user is ever touched"). user_id below is the
  -- only FK that should cascade here.
  workspace_id uuid references public.workspaces (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Optional anchor to an existing workspace goal — never the reverse FK:
  -- one objective may have many journeys over time (see migration header).
  objective_id uuid references public.workspace_objectives (id) on delete set null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index intelligence_journeys_user_id_idx on public.intelligence_journeys (user_id);
create index intelligence_journeys_workspace_id_idx on public.intelligence_journeys (workspace_id) where workspace_id is not null;
create index intelligence_journeys_objective_id_idx on public.intelligence_journeys (objective_id) where objective_id is not null;

create trigger set_intelligence_journeys_updated_at
  before update on public.intelligence_journeys
  for each row execute function public.set_updated_at();

create table public.intelligence_records (
  id uuid primary key default gen_random_uuid(),
  -- set null, not cascade — same reasoning as intelligence_journeys.workspace_id above.
  workspace_id uuid references public.workspaces (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  journey_id uuid references public.intelligence_journeys (id) on delete set null,
  record_type public.intelligence_record_type not null,
  status public.intelligence_record_status not null default 'completed',
  -- Always populated: a cheap, human-readable label so History can list
  -- records without parsing structured_output.
  summary text not null,
  -- The engine's own already-parsed, already-validated result object,
  -- verbatim — never a raw prompt or raw unparsed model completion (see
  -- migration header's persistence discipline).
  structured_output jsonb not null,
  -- Precomputed once, at write time, by calling the existing
  -- src/shared/provenance/ adapter for this record_type — either the
  -- shared ProvenanceChain shape (data/analysis/research/planning/
  -- decision/action) or Execution Foundation's own distinct
  -- ExecutionProvenance shape (execution). Null only when an adapter
  -- genuinely produced nothing to cite (e.g. a declined/empty result —
  -- though v1's write hooks only ever fire on real completions).
  provenance jsonb,
  -- Correlates to a runtime IntelligenceOperation (see
  -- src/shared/lib/intelligenceOperations.ts) — itself never persisted
  -- anywhere else today, so this is that value's first durable record.
  -- Null for engines/paths with no Operation Budget wiring (Execution
  -- Foundation's v1 safe capabilities have no AI call to meter; a future
  -- chat- or image-analysis-derived record would be null too).
  operation_id uuid,
  -- Which provider actually produced this record's content (the
  -- FallbackResult.providerId every AI call site already computes but,
  -- before this migration, discarded) — null when no AI call was
  -- involved (a deterministic Execution Foundation safe capability).
  provider_id text,
  -- Reserved for a future chat-invoked (not just page-invoked) engine
  -- run — no current engine accepts this as an entry parameter, so v1
  -- never populates it. See migration header.
  conversation_id uuid references public.conversations (id) on delete set null,
  -- Bridges an 'execution' record to Execution Foundation's own detailed
  -- tables (authorizations/attempts/audit_events) — the Ledger is the
  -- intelligence-level summary, execution_requests remains the
  -- operational-level source of truth; this migration does not
  -- duplicate that subsystem.
  execution_request_id uuid references public.execution_requests (id) on delete set null,
  -- Precise one-hop lineage ("this record was derived from THIS one") —
  -- see migration header. Never fabricated: null unless a real
  -- originating record id was available at write time.
  parent_record_id uuid references public.intelligence_records (id) on delete set null,
  -- Reserved for future outcome tracking (Capability "Learn") — not
  -- populated or evaluated by this migration or any code it ships with.
  expected_outcome text,
  actual_outcome text,
  outcome_evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index intelligence_records_user_id_idx on public.intelligence_records (user_id);
create index intelligence_records_workspace_id_idx on public.intelligence_records (workspace_id) where workspace_id is not null;
create index intelligence_records_journey_id_idx on public.intelligence_records (journey_id) where journey_id is not null;
create index intelligence_records_record_type_idx on public.intelligence_records (record_type);
create index intelligence_records_status_idx on public.intelligence_records (status);
create index intelligence_records_parent_record_id_idx on public.intelligence_records (parent_record_id) where parent_record_id is not null;
create index intelligence_records_created_at_idx on public.intelligence_records (created_at);

create trigger set_intelligence_records_updated_at
  before update on public.intelligence_records
  for each row execute function public.set_updated_at();

alter table public.intelligence_journeys enable row level security;
alter table public.intelligence_records enable row level security;

create policy "Journey owners and workspace members can view journeys"
  on public.intelligence_journeys for select
  to authenticated
  using ((select auth.uid()) = user_id or public.has_workspace_role(workspace_id, 'viewer'));

create policy "Record owners and workspace members can view records"
  on public.intelligence_records for select
  to authenticated
  using ((select auth.uid()) = user_id or public.has_workspace_role(workspace_id, 'viewer'));

-- Deliberately no insert/update/delete policy on either table: creation
-- goes exclusively through the two SECURITY DEFINER RPCs below (so
-- ownership/lineage/workspace-membership validation is atomic with the
-- row appearing), and neither table is ever updated by application code
-- in this phase (superseded/archived status transitions and outcome
-- evaluation are explicitly future scope — see migration header).

revoke insert, update, delete, truncate on public.intelligence_journeys from authenticated;
revoke all on public.intelligence_journeys from anon;
revoke insert, update, delete, truncate on public.intelligence_records from authenticated;
revoke all on public.intelligence_records from anon;

-- ---------------------------------------------------------------------
-- create_intelligence_journey() — the only way an intelligence_journeys
-- row can be created. If p_objective_id is supplied, verifies the
-- objective is one the caller can actually see (own it, or hold at
-- least viewer access to its workspace) — never lets objective_id
-- silently attach a journey to an objective the caller has no
-- relationship to.
-- ---------------------------------------------------------------------

create or replace function public.create_intelligence_journey(
  p_workspace_id uuid,
  p_objective_id uuid,
  p_title text
)
returns public.intelligence_journeys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_journey public.intelligence_journeys;
begin
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'create_intelligence_journey: title is required';
  end if;

  if p_workspace_id is not null and not public.has_workspace_role(p_workspace_id, 'viewer') then
    raise exception 'create_intelligence_journey: not authorized for this workspace';
  end if;

  if p_objective_id is not null then
    if not exists (
      select 1 from public.workspace_objectives wo
      where wo.id = p_objective_id
        and (wo.user_id = (select auth.uid()) or public.has_workspace_role(wo.workspace_id, 'viewer'))
    ) then
      raise exception 'create_intelligence_journey: objective not found or not accessible';
    end if;
  end if;

  insert into public.intelligence_journeys (workspace_id, user_id, objective_id, title)
  values (p_workspace_id, (select auth.uid()), p_objective_id, p_title)
  returning * into v_journey;

  return v_journey;
end;
$$;

revoke all on function public.create_intelligence_journey(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_intelligence_journey(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- create_intelligence_record() — the only way an intelligence_records
-- row can be created. user_id is always (select auth.uid()), never
-- client-supplied. Any referenced journey_id, parent_record_id, or
-- execution_request_id must already belong to the caller — a client
-- cannot attach a record to someone else's journey or lineage chain, and
-- cannot claim another user's execution request as its own. workspace_id
-- requires at least viewer access, so it cannot be used to inject a
-- record into a workspace's shared history the caller has no membership
-- in.
-- ---------------------------------------------------------------------

create or replace function public.create_intelligence_record(
  p_workspace_id uuid,
  p_journey_id uuid,
  p_record_type text,
  p_summary text,
  p_structured_output jsonb,
  p_status text default 'completed',
  p_provenance jsonb default null,
  p_operation_id uuid default null,
  p_provider_id text default null,
  p_conversation_id uuid default null,
  p_execution_request_id uuid default null,
  p_parent_record_id uuid default null,
  p_expected_outcome text default null
)
returns public.intelligence_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record public.intelligence_records;
begin
  if p_record_type not in ('data', 'analysis', 'research', 'planning', 'decision', 'action', 'execution') then
    raise exception 'create_intelligence_record: invalid record_type %', p_record_type;
  end if;
  if p_status not in ('created', 'running', 'completed', 'failed', 'superseded', 'archived') then
    raise exception 'create_intelligence_record: invalid status %', p_status;
  end if;
  if p_summary is null or length(trim(p_summary)) = 0 then
    raise exception 'create_intelligence_record: summary is required';
  end if;
  if p_structured_output is null then
    raise exception 'create_intelligence_record: structured_output is required';
  end if;

  if p_workspace_id is not null and not public.has_workspace_role(p_workspace_id, 'viewer') then
    raise exception 'create_intelligence_record: not authorized for this workspace';
  end if;

  if p_journey_id is not null and not exists (
    select 1 from public.intelligence_journeys ij where ij.id = p_journey_id and ij.user_id = (select auth.uid())
  ) then
    raise exception 'create_intelligence_record: journey not found or not owned by caller';
  end if;

  if p_parent_record_id is not null and not exists (
    select 1 from public.intelligence_records ir where ir.id = p_parent_record_id and ir.user_id = (select auth.uid())
  ) then
    raise exception 'create_intelligence_record: parent record not found or not owned by caller';
  end if;

  if p_execution_request_id is not null and not exists (
    select 1 from public.execution_requests er where er.id = p_execution_request_id and er.user_id = (select auth.uid())
  ) then
    raise exception 'create_intelligence_record: execution request not found or not owned by caller';
  end if;

  insert into public.intelligence_records (
    workspace_id, user_id, journey_id, record_type, status, summary, structured_output,
    provenance, operation_id, provider_id, conversation_id, execution_request_id, parent_record_id, expected_outcome
  )
  values (
    p_workspace_id, (select auth.uid()), p_journey_id, p_record_type::public.intelligence_record_type, p_status::public.intelligence_record_status, p_summary, p_structured_output,
    p_provenance, p_operation_id, p_provider_id, p_conversation_id, p_execution_request_id, p_parent_record_id, p_expected_outcome
  )
  returning * into v_record;

  return v_record;
end;
$$;

revoke all on function public.create_intelligence_record(uuid, uuid, text, text, jsonb, text, jsonb, uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_intelligence_record(uuid, uuid, text, text, jsonb, text, jsonb, uuid, text, uuid, uuid, uuid, text) to authenticated;
