-- ARRIYIA — Execution Foundation. The controlled boundary between an
-- Action Intelligence proposal and anything actually happening:
--
--   ACTION -> EXECUTION REQUEST -> AUTHORIZATION -> CONTROLLED EXECUTOR
--     -> RESULT -> AUDIT
--
-- An action being READY (see action-intelligence's own computeActionReadiness)
-- never implies it is authorized to execute — readiness and authorization
-- are deliberately separate concerns recorded in separate tables. This
-- migration is purely additive: four new tables, five new
-- SECURITY DEFINER RPCs, zero changes to any existing table.
--
-- SECURITY MODEL (mirrors apply_subscription_event's own precedent in
-- 0047_billing_tables_and_subscription_event_function.sql):
--   - Creating a PROPOSAL (an execution_requests row) is low-risk — it is
--     just a record saying "this could happen" — so it is a plain,
--     RLS-scoped client insert, the same shape as every other
--     user-authored table in this codebase.
--   - Every STATE TRANSITION (authorize / start / record an attempt /
--     cancel / expire) is a security boundary and goes ONLY through a
--     SECURITY DEFINER RPC below. No UPDATE grant is given to
--     `authenticated` on execution_requests, and NO insert/update grant
--     at all is given on execution_authorizations / execution_attempts /
--     execution_audit_events — a client cannot forge an approval, a
--     successful attempt, or an audit event by writing to the tables
--     directly, only by calling a function that enforces ownership,
--     valid-transition, expiry, and contract-hash checks server-side.
--   - Every RPC re-checks `execution_requests.user_id = (select auth.uid())`
--     itself (actor isolation) — a user can never authorize, start,
--     record an attempt against, cancel, or expire another user's
--     execution request, regardless of what the client sends.

create table public.execution_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  capability text not null,
  status text not null default 'proposed' check (status in ('proposed', 'awaiting_approval', 'approved', 'rejected', 'executing', 'succeeded', 'failed', 'cancelled', 'expired')),
  -- The Action Intelligence Action this request was raised from, frozen at
  -- creation time — never re-read live from the action engine (which
  -- persists nothing), so the contract this request describes cannot
  -- silently drift out from under an already-granted authorization.
  action_snapshot jsonb,
  -- Honest provenance: what produced this request (an Action Intelligence
  -- action id + its own source, a plan/decision id, or a manual/UI origin)
  -- — never fabricated, matching every other engine's own provenance
  -- discipline in this codebase.
  source jsonb not null default '{}'::jsonb,
  target jsonb not null default '{}'::jsonb,
  input_payload jsonb not null default '{}'::jsonb,
  expected_effect text not null default '',
  risk_classification text not null default 'low' check (risk_classification in ('low', 'medium', 'high')),
  external_side_effects boolean not null default false,
  -- Idempotency: a second request submitted with the same key by the same
  -- user collides on this constraint rather than creating a duplicate row
  -- — see src/modules/execution-foundation/api/createExecutionRequest.ts.
  idempotency_key text not null,
  -- A stable hash of the contract's own material fields (capability/
  -- target/input_payload/expected_effect), computed once at creation and
  -- never recomputed from a later mutation (there is none — see below).
  -- start_execution() below compares this against the hash an
  -- authorization actually approved, so an authorization can never be
  -- silently carried over to a materially different contract.
  contract_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint execution_requests_user_idempotency_key unique (user_id, idempotency_key)
);

create index execution_requests_user_id_idx on public.execution_requests (user_id);
create index execution_requests_workspace_id_idx on public.execution_requests (workspace_id) where workspace_id is not null;
create index execution_requests_status_idx on public.execution_requests (status);

create trigger set_execution_requests_updated_at
  before update on public.execution_requests
  for each row execute function public.set_updated_at();

create table public.execution_authorizations (
  id uuid primary key default gen_random_uuid(),
  execution_request_id uuid not null references public.execution_requests (id) on delete cascade,
  approving_user_id uuid not null references auth.users (id),
  decision text not null check (decision in ('approved', 'rejected')),
  capability text not null,
  target jsonb not null default '{}'::jsonb,
  scope jsonb not null default '{}'::jsonb,
  contract_hash_at_approval text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index execution_authorizations_request_id_idx on public.execution_authorizations (execution_request_id);

create table public.execution_attempts (
  id uuid primary key default gen_random_uuid(),
  execution_request_id uuid not null references public.execution_requests (id) on delete cascade,
  attempt_number int not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  outcome text check (outcome in ('succeeded', 'failed')),
  failure_kind text check (failure_kind in ('validation', 'authorization', 'capability_unavailable', 'dependency', 'timeout', 'transient', 'permanent', 'external_rejection', 'unknown')),
  failure_message text,
  result jsonb,
  constraint execution_attempts_request_attempt_key unique (execution_request_id, attempt_number)
);

create index execution_attempts_request_id_idx on public.execution_attempts (execution_request_id);

create table public.execution_audit_events (
  id uuid primary key default gen_random_uuid(),
  execution_request_id uuid not null references public.execution_requests (id) on delete cascade,
  event_type text not null,
  actor_user_id uuid references auth.users (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index execution_audit_events_request_id_idx on public.execution_audit_events (execution_request_id);

alter table public.execution_requests enable row level security;
alter table public.execution_authorizations enable row level security;
alter table public.execution_attempts enable row level security;
alter table public.execution_audit_events enable row level security;

create policy "Users can view their own execution requests"
  on public.execution_requests for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Deliberately no insert/update/delete policy: creation goes through
-- create_execution_request() below (so contract validation and the
-- creation audit events are atomic with the row appearing), and every
-- status transition happens exclusively through the other SECURITY
-- DEFINER RPCs below.

create policy "Users can view authorizations for their own requests"
  on public.execution_authorizations for select
  to authenticated
  using (exists (select 1 from public.execution_requests er where er.id = execution_authorizations.execution_request_id and er.user_id = (select auth.uid())));

create policy "Users can view attempts for their own requests"
  on public.execution_attempts for select
  to authenticated
  using (exists (select 1 from public.execution_requests er where er.id = execution_attempts.execution_request_id and er.user_id = (select auth.uid())));

create policy "Users can view audit events for their own requests"
  on public.execution_audit_events for select
  to authenticated
  using (exists (select 1 from public.execution_requests er where er.id = execution_audit_events.execution_request_id and er.user_id = (select auth.uid())));

revoke insert, update, delete, truncate on public.execution_requests from authenticated;
revoke all on public.execution_requests from anon;
revoke insert, update, delete, truncate on public.execution_authorizations from authenticated;
revoke all on public.execution_authorizations from anon;
revoke insert, update, delete, truncate on public.execution_attempts from authenticated;
revoke all on public.execution_attempts from anon;
revoke insert, update, delete, truncate on public.execution_audit_events from authenticated;
revoke all on public.execution_audit_events from anon;

-- ---------------------------------------------------------------------
-- create_execution_request() — the only way an execution_requests row
-- can be created. Idempotent: a second call with a (user, idempotency
-- key) pair that already exists returns the EXISTING row rather than
-- raising or inserting a duplicate — "same request submitted twice"
-- is deterministically a no-op, never a second execution path. New
-- requests start in 'awaiting_approval' (there is no separate implicit
-- "proposed, not yet under review" state in this v1's single-approver
-- flow — see execution.ts's own doc comment) with both an
-- 'execution_requested' and 'authorization_requested' audit event
-- emitted atomically alongside the row.
-- ---------------------------------------------------------------------

create or replace function public.create_execution_request(
  p_workspace_id uuid,
  p_capability text,
  p_action_snapshot jsonb,
  p_source jsonb,
  p_target jsonb,
  p_input_payload jsonb,
  p_expected_effect text,
  p_risk_classification text,
  p_external_side_effects boolean,
  p_idempotency_key text,
  p_contract_hash text,
  p_ttl_seconds int default 86400
)
returns public.execution_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.execution_requests;
  v_request public.execution_requests;
begin
  if p_risk_classification not in ('low', 'medium', 'high') then
    raise exception 'create_execution_request: invalid risk classification %', p_risk_classification;
  end if;
  if p_capability is null or length(trim(p_capability)) = 0 then
    raise exception 'create_execution_request: capability is required';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) = 0 then
    raise exception 'create_execution_request: idempotency key is required';
  end if;

  select * into v_existing
  from public.execution_requests
  where user_id = (select auth.uid()) and idempotency_key = p_idempotency_key;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.execution_requests (
    user_id, workspace_id, capability, status, action_snapshot, source, target, input_payload,
    expected_effect, risk_classification, external_side_effects, idempotency_key, contract_hash, expires_at
  )
  values (
    (select auth.uid()), p_workspace_id, p_capability, 'awaiting_approval', p_action_snapshot, p_source, p_target, p_input_payload,
    p_expected_effect, p_risk_classification, p_external_side_effects, p_idempotency_key, p_contract_hash, now() + make_interval(secs => p_ttl_seconds)
  )
  returning * into v_request;

  insert into public.execution_audit_events (execution_request_id, event_type, actor_user_id, metadata)
  values (v_request.id, 'execution_requested', (select auth.uid()), jsonb_build_object('capability', p_capability));

  insert into public.execution_audit_events (execution_request_id, event_type, actor_user_id, metadata)
  values (v_request.id, 'authorization_requested', (select auth.uid()), '{}'::jsonb);

  return v_request;
end;
$$;

revoke all on function public.create_execution_request(uuid, text, jsonb, jsonb, jsonb, jsonb, text, text, boolean, text, text, int) from public, anon, authenticated;
grant execute on function public.create_execution_request(uuid, text, jsonb, jsonb, jsonb, jsonb, text, text, boolean, text, text, int) to authenticated;

-- ---------------------------------------------------------------------
-- authorize_execution_request() — the Approval Gate. The only path by
-- which a request can move from proposed/awaiting_approval to
-- approved/rejected. Records who approved, when, what was approved
-- (capability/target/scope), and the exact contract hash approved —
-- never a bare `approved: true`.
-- ---------------------------------------------------------------------

create or replace function public.authorize_execution_request(
  p_execution_request_id uuid,
  p_decision text,
  p_scope jsonb default '{}'::jsonb,
  p_expires_at timestamptz default null
)
returns public.execution_authorizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.execution_requests;
  v_authorization public.execution_authorizations;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'authorize_execution_request: invalid decision %', p_decision;
  end if;

  select * into v_request from public.execution_requests where id = p_execution_request_id for update;
  if v_request is null then
    raise exception 'authorize_execution_request: execution request % not found', p_execution_request_id;
  end if;
  if v_request.user_id <> (select auth.uid()) then
    raise exception 'authorize_execution_request: not authorized to act on this execution request';
  end if;
  if v_request.status not in ('proposed', 'awaiting_approval') then
    raise exception 'authorize_execution_request: cannot authorize a request in status %', v_request.status;
  end if;
  if v_request.expires_at < now() then
    update public.execution_requests set status = 'expired' where id = v_request.id;
    raise exception 'authorize_execution_request: this execution request has expired';
  end if;

  insert into public.execution_authorizations (execution_request_id, approving_user_id, decision, capability, target, scope, contract_hash_at_approval, expires_at)
  values (v_request.id, (select auth.uid()), p_decision, v_request.capability, v_request.target, p_scope, v_request.contract_hash, p_expires_at)
  returning * into v_authorization;

  update public.execution_requests set status = p_decision where id = v_request.id;

  insert into public.execution_audit_events (execution_request_id, event_type, actor_user_id, metadata)
  values (v_request.id, case when p_decision = 'approved' then 'authorization_granted' else 'authorization_rejected' end, (select auth.uid()), jsonb_build_object('authorization_id', v_authorization.id));

  return v_authorization;
end;
$$;

revoke all on function public.authorize_execution_request(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.authorize_execution_request(uuid, text, jsonb, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- start_execution() — approved -> executing. Re-verifies the most
-- recent authorization is still 'approved', unexpired, and was granted
-- against the SAME contract hash the request still carries — a request
-- can never begin executing on an authorization that approved a
-- different contract.
-- ---------------------------------------------------------------------

create or replace function public.start_execution(p_execution_request_id uuid)
returns public.execution_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.execution_requests;
  v_authorization public.execution_authorizations;
begin
  select * into v_request from public.execution_requests where id = p_execution_request_id for update;
  if v_request is null then
    raise exception 'start_execution: execution request % not found', p_execution_request_id;
  end if;
  if v_request.user_id <> (select auth.uid()) then
    raise exception 'start_execution: not authorized to act on this execution request';
  end if;
  if v_request.status <> 'approved' then
    raise exception 'start_execution: cannot start a request in status %', v_request.status;
  end if;

  select * into v_authorization
  from public.execution_authorizations
  where execution_request_id = v_request.id and decision = 'approved'
  order by created_at desc
  limit 1;

  if v_authorization is null then
    raise exception 'start_execution: no approval found for this execution request';
  end if;
  if v_authorization.expires_at is not null and v_authorization.expires_at < now() then
    update public.execution_requests set status = 'expired' where id = v_request.id;
    raise exception 'start_execution: the authorization for this execution request has expired';
  end if;
  if v_authorization.contract_hash_at_approval <> v_request.contract_hash then
    raise exception 'start_execution: the execution contract changed materially since it was approved';
  end if;

  update public.execution_requests set status = 'executing' where id = v_request.id returning * into v_request;

  insert into public.execution_audit_events (execution_request_id, event_type, actor_user_id, metadata)
  values (v_request.id, 'execution_started', (select auth.uid()), '{}'::jsonb);

  return v_request;
end;
$$;

revoke all on function public.start_execution(uuid) from public, anon, authenticated;
grant execute on function public.start_execution(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- record_execution_attempt() — the only way an execution_attempts row
-- can be created. p_is_final distinguishes a transient failure a bounded
-- retry policy will follow up on (status stays 'executing') from a
-- terminal outcome (status becomes 'succeeded'/'failed') — the retry
-- DECISION itself is made deterministically by application code (see
-- retryPolicy.ts), never by this function and never by a model.
-- ---------------------------------------------------------------------

create or replace function public.record_execution_attempt(
  p_execution_request_id uuid,
  p_outcome text,
  p_failure_kind text default null,
  p_failure_message text default null,
  p_result jsonb default null,
  p_is_final boolean default true
)
returns public.execution_attempts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.execution_requests;
  v_next_attempt int;
  v_attempt public.execution_attempts;
begin
  if p_outcome not in ('succeeded', 'failed') then
    raise exception 'record_execution_attempt: invalid outcome %', p_outcome;
  end if;

  select * into v_request from public.execution_requests where id = p_execution_request_id for update;
  if v_request is null then
    raise exception 'record_execution_attempt: execution request % not found', p_execution_request_id;
  end if;
  if v_request.user_id <> (select auth.uid()) then
    raise exception 'record_execution_attempt: not authorized to act on this execution request';
  end if;
  if v_request.status <> 'executing' then
    raise exception 'record_execution_attempt: cannot record an attempt for a request in status %', v_request.status;
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_next_attempt from public.execution_attempts where execution_request_id = v_request.id;

  insert into public.execution_attempts (execution_request_id, attempt_number, completed_at, outcome, failure_kind, failure_message, result)
  values (v_request.id, v_next_attempt, now(), p_outcome, p_failure_kind, p_failure_message, p_result)
  returning * into v_attempt;

  insert into public.execution_audit_events (execution_request_id, event_type, actor_user_id, metadata)
  values (v_request.id, case when p_outcome = 'succeeded' then 'attempt_succeeded' else 'attempt_failed' end, (select auth.uid()), jsonb_build_object('attempt_number', v_next_attempt, 'failure_kind', p_failure_kind));

  if p_outcome = 'succeeded' then
    update public.execution_requests set status = 'succeeded' where id = v_request.id;
    insert into public.execution_audit_events (execution_request_id, event_type, actor_user_id, metadata) values (v_request.id, 'execution_completed', (select auth.uid()), '{}'::jsonb);
  elsif p_is_final then
    update public.execution_requests set status = 'failed' where id = v_request.id;
    insert into public.execution_audit_events (execution_request_id, event_type, actor_user_id, metadata) values (v_request.id, 'execution_failed', (select auth.uid()), jsonb_build_object('failure_kind', p_failure_kind));
  end if;

  return v_attempt;
end;
$$;

revoke all on function public.record_execution_attempt(uuid, text, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.record_execution_attempt(uuid, text, text, text, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- cancel_execution() — allowed from any non-terminal state. A cancelled
-- request can never resume; a fresh request/authorization is required.
-- ---------------------------------------------------------------------

create or replace function public.cancel_execution(p_execution_request_id uuid, p_reason text default null)
returns public.execution_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.execution_requests;
begin
  select * into v_request from public.execution_requests where id = p_execution_request_id for update;
  if v_request is null then
    raise exception 'cancel_execution: execution request % not found', p_execution_request_id;
  end if;
  if v_request.user_id <> (select auth.uid()) then
    raise exception 'cancel_execution: not authorized to act on this execution request';
  end if;
  if v_request.status not in ('proposed', 'awaiting_approval', 'approved', 'executing') then
    raise exception 'cancel_execution: cannot cancel a request in status %', v_request.status;
  end if;

  update public.execution_requests set status = 'cancelled' where id = v_request.id returning * into v_request;

  insert into public.execution_audit_events (execution_request_id, event_type, actor_user_id, metadata)
  values (v_request.id, 'execution_cancelled', (select auth.uid()), jsonb_build_object('reason', p_reason));

  return v_request;
end;
$$;

revoke all on function public.cancel_execution(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_execution(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- expire_execution() — a client-driven "this TTL has passed" transition
-- (there is no background cron in this phase), still server-verified
-- against the request's own expires_at rather than trusted from the
-- client's clock.
-- ---------------------------------------------------------------------

create or replace function public.expire_execution(p_execution_request_id uuid)
returns public.execution_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.execution_requests;
begin
  select * into v_request from public.execution_requests where id = p_execution_request_id for update;
  if v_request is null then
    raise exception 'expire_execution: execution request % not found', p_execution_request_id;
  end if;
  if v_request.user_id <> (select auth.uid()) then
    raise exception 'expire_execution: not authorized to act on this execution request';
  end if;
  if v_request.status not in ('proposed', 'awaiting_approval', 'approved') then
    raise exception 'expire_execution: cannot expire a request in status %', v_request.status;
  end if;
  if v_request.expires_at >= now() then
    raise exception 'expire_execution: this execution request has not passed its expiration yet';
  end if;

  update public.execution_requests set status = 'expired' where id = v_request.id returning * into v_request;

  insert into public.execution_audit_events (execution_request_id, event_type, actor_user_id, metadata)
  values (v_request.id, 'execution_expired', (select auth.uid()), '{}'::jsonb);

  return v_request;
end;
$$;

revoke all on function public.expire_execution(uuid) from public, anon, authenticated;
grant execute on function public.expire_execution(uuid) to authenticated;
