-- IF-02 Shared Intelligence Foundation.
-- Additive only: preserve the canonical ledger and provenance ontology.
-- Domain identity is separate from engine record_type; legacy rows remain NULL.
alter table public.intelligence_records
  add column domain_key text
  check (domain_key is null or domain_key in (
    'finance', 'marketing', 'sales', 'operations', 'hr', 'legal', 'customer', 'risk'
  ));

create index intelligence_records_domain_key_idx
  on public.intelligence_records (domain_key)
  where domain_key is not null;

comment on column public.intelligence_records.domain_key is
  'IF-02 business domain identity; independent of engine record_type. NULL for legacy/non-domain records.';

-- Security remediation S-02: objectives are owner-scoped by migration 0021.
-- A journey can only reference its owner's objective in the exact same workspace.
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
  v_objective_workspace_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'create_intelligence_journey: authentication required';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'create_intelligence_journey: title is required';
  end if;
  if p_workspace_id is not null and not public.has_workspace_role(p_workspace_id, 'viewer') then
    raise exception 'create_intelligence_journey: not authorized for this workspace';
  end if;

  if p_objective_id is not null then
    if p_workspace_id is null then
      raise exception 'create_intelligence_journey: a personal journey cannot reference a workspace objective';
    end if;

    select wo.workspace_id into v_objective_workspace_id
    from public.workspace_objectives wo
    where wo.id = p_objective_id
      and wo.user_id = (select auth.uid());

    if not found then
      raise exception 'create_intelligence_journey: objective not found or not owned by caller';
    end if;
    if v_objective_workspace_id is distinct from p_workspace_id then
      raise exception 'create_intelligence_journey: objective workspace must match journey workspace';
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

-- Security remediation S-01: conversations are private under migration 0005.
-- No sharing policy is approved, so only the owner may attach one. Its workspace
-- must equal the record's workspace to prevent cross-scope provenance.
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
  v_conversation_workspace_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'create_intelligence_record: authentication required';
  end if;
  if p_record_type not in ('data', 'analysis', 'research', 'planning', 'decision', 'action', 'execution') then
    raise exception 'create_intelligence_record: invalid record_type %', p_record_type;
  end if;
  if p_status not in ('created', 'running', 'completed', 'failed', 'superseded', 'archived') then
    raise exception 'create_intelligence_record: invalid status %', p_status;
  end if;
  if p_summary is null or length(trim(p_summary)) = 0 then
    raise exception 'create_intelligence_record: summary is required';
  end if;
  if p_structured_output is null or jsonb_typeof(p_structured_output) <> 'object' then
    raise exception 'create_intelligence_record: structured_output must be a JSON object';
  end if;

  if p_workspace_id is not null and not public.has_workspace_role(p_workspace_id, 'viewer') then
    raise exception 'create_intelligence_record: not authorized for this workspace';
  end if;

  if p_journey_id is not null and not exists (
    select 1 from public.intelligence_journeys ij
    where ij.id = p_journey_id
      and ij.user_id = (select auth.uid())
      and ij.workspace_id is not distinct from p_workspace_id
  ) then
    raise exception 'create_intelligence_record: journey not found, not owned by caller, or workspace scope mismatch';
  end if;

  if p_parent_record_id is not null and not exists (
    select 1 from public.intelligence_records ir
    where ir.id = p_parent_record_id
      and ir.user_id = (select auth.uid())
      and ir.workspace_id is not distinct from p_workspace_id
  ) then
    raise exception 'create_intelligence_record: parent record not found, not owned by caller, or workspace scope mismatch';
  end if;

  if p_execution_request_id is not null and not exists (
    select 1 from public.execution_requests er
    where er.id = p_execution_request_id and er.user_id = (select auth.uid())
  ) then
    raise exception 'create_intelligence_record: execution request not found or not owned by caller';
  end if;

  if p_conversation_id is not null then
    select c.workspace_id into v_conversation_workspace_id
    from public.conversations c
    where c.id = p_conversation_id and c.user_id = (select auth.uid());

    if not found then
      raise exception 'create_intelligence_record: conversation not found or not owned by caller';
    end if;
    if v_conversation_workspace_id is distinct from p_workspace_id then
      raise exception 'create_intelligence_record: conversation workspace must match record workspace';
    end if;
  end if;

  insert into public.intelligence_records (
    workspace_id, user_id, journey_id, record_type, status, summary, structured_output,
    provenance, operation_id, provider_id, conversation_id, execution_request_id,
    parent_record_id, expected_outcome
  )
  values (
    p_workspace_id, (select auth.uid()), p_journey_id,
    p_record_type::public.intelligence_record_type,
    p_status::public.intelligence_record_status, p_summary, p_structured_output,
    p_provenance, p_operation_id, p_provider_id, p_conversation_id,
    p_execution_request_id, p_parent_record_id, p_expected_outcome
  )
  returning * into v_record;
  return v_record;
end;
$$;

revoke all on function public.create_intelligence_record(uuid, uuid, text, text, jsonb, text, jsonb, uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_intelligence_record(uuid, uuid, text, text, jsonb, text, jsonb, uuid, text, uuid, uuid, uuid, text) to authenticated;

-- Canonical domain-aware write boundary. This delegates ownership, workspace,
-- journey, conversation, execution, and parent validation to the ledger RPC,
-- then tags the just-created row inside the same transaction. Domain is never
-- inferred from record_type and never accepted through direct table writes.
create or replace function public.create_domain_intelligence_record(
  p_domain_key text,
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
  v_item jsonb;
  v_entry jsonb;
  v_ref jsonb;
  v_id text;
  v_evidence_ids text[] := array[]::text[];
  v_seen_ids text[] := array[]::text[];
begin
  if (select auth.uid()) is null then
    raise exception 'create_domain_intelligence_record: authentication required';
  end if;
  if not public.has_feature((select auth.uid()), 'domain_intelligence') then
    raise exception 'create_domain_intelligence_record: domain intelligence requires an entitled plan';
  end if;
  if p_domain_key is null or p_domain_key not in ('finance', 'marketing', 'sales', 'operations', 'hr', 'legal', 'customer', 'risk') then
    raise exception 'create_domain_intelligence_record: invalid domain_key %', p_domain_key;
  end if;
  if p_structured_output is null
     or jsonb_typeof(p_structured_output) is distinct from 'object'
     or p_structured_output ->> 'schemaVersion' is distinct from '1'
     or p_structured_output ->> 'domain' is distinct from p_domain_key
     or jsonb_typeof(p_structured_output -> 'evidence') is distinct from 'array'
     or jsonb_typeof(p_structured_output -> 'findings') is distinct from 'array'
     or jsonb_typeof(p_structured_output -> 'recommendations') is distinct from 'array' then
    raise exception 'create_domain_intelligence_record: structured_output does not match IF-02 domain contract';
  end if;

  -- Validate every evidence item at the trusted write boundary, not only in the UI.
  for v_item in select value from jsonb_array_elements(p_structured_output -> 'evidence') as e(value) loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or nullif(btrim(v_item ->> 'id'), '') is null
       or nullif(btrim(v_item ->> 'statement'), '') is null
       or v_item ->> 'kind' is null
       or v_item ->> 'kind' not in ('verified_fact', 'deterministic_calculation', 'assumption', 'hypothesis', 'recommendation')
       or not (v_item ? 'sourceRef')
       or jsonb_typeof(v_item -> 'sourceRef') not in ('null', 'string')
       or not (v_item ? 'confidence')
       or jsonb_typeof(v_item -> 'confidence') not in ('null', 'number') then
      raise exception 'create_domain_intelligence_record: malformed evidence item';
    end if;
    if jsonb_typeof(v_item -> 'confidence') = 'number'
       and ((v_item ->> 'confidence')::numeric < 0 or (v_item ->> 'confidence')::numeric > 1) then
      raise exception 'create_domain_intelligence_record: evidence confidence must be between 0 and 1';
    end if;
    v_id := v_item ->> 'id';
    if v_id = any(v_seen_ids) then
      raise exception 'create_domain_intelligence_record: evidence ids must be unique';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_id);
    v_evidence_ids := array_append(v_evidence_ids, v_id);
  end loop;

  -- Findings and recommendations must cite evidence from this exact output.
  for v_entry in select value from jsonb_array_elements(p_structured_output -> 'findings') as f(value) loop
    if jsonb_typeof(v_entry) is distinct from 'object'
       or nullif(btrim(v_entry ->> 'id'), '') is null
       or nullif(btrim(v_entry ->> 'statement'), '') is null
       or jsonb_typeof(v_entry -> 'evidenceIds') is distinct from 'array' then
      raise exception 'create_domain_intelligence_record: malformed finding';
    end if;
    for v_ref in select value from jsonb_array_elements(v_entry -> 'evidenceIds') as r(value) loop
      if jsonb_typeof(v_ref) is distinct from 'string' or not ((v_ref #>> '{}') = any(v_evidence_ids)) then
        raise exception 'create_domain_intelligence_record: finding references unknown evidence';
      end if;
    end loop;
  end loop;

  for v_entry in select value from jsonb_array_elements(p_structured_output -> 'recommendations') as r(value) loop
    if jsonb_typeof(v_entry) is distinct from 'object'
       or nullif(btrim(v_entry ->> 'id'), '') is null
       or nullif(btrim(v_entry ->> 'statement'), '') is null
       or jsonb_typeof(v_entry -> 'evidenceIds') is distinct from 'array'
       or jsonb_typeof(v_entry -> 'requiresApproval') is distinct from 'boolean' then
      raise exception 'create_domain_intelligence_record: malformed recommendation';
    end if;
    for v_ref in select value from jsonb_array_elements(v_entry -> 'evidenceIds') as r(value) loop
      if jsonb_typeof(v_ref) is distinct from 'string' or not ((v_ref #>> '{}') = any(v_evidence_ids)) then
        raise exception 'create_domain_intelligence_record: recommendation references unknown evidence';
      end if;
    end loop;
  end loop;

  select * into v_record
  from public.create_intelligence_record(
    p_workspace_id, p_journey_id, p_record_type, p_summary, p_structured_output,
    p_status, p_provenance, p_operation_id, p_provider_id, p_conversation_id,
    p_execution_request_id, p_parent_record_id, p_expected_outcome
  );

  update public.intelligence_records
  set domain_key = p_domain_key
  where id = v_record.id and user_id = (select auth.uid())
  returning * into v_record;

  if not found then
    raise exception 'create_domain_intelligence_record: record tagging failed';
  end if;
  return v_record;
end;
$$;

revoke all on function public.create_domain_intelligence_record(text, uuid, uuid, text, text, jsonb, text, jsonb, uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_domain_intelligence_record(text, uuid, uuid, text, text, jsonb, text, jsonb, uuid, text, uuid, uuid, uuid, text) to authenticated;


-- IF-02 shared foundation entitlement. Domain intelligence is a Pro capability;
-- enforcement is server-side in create_domain_intelligence_record(), not a UI hint.
insert into public.plan_quotas (plan_id, quota_key, quota_limit, quota_period)
select p.id, 'feature:domain_intelligence', 1, 'monthly'
from public.plans p
where p.code in ('pro', 'founding_pro')
on conflict (plan_id, quota_key) do nothing;
