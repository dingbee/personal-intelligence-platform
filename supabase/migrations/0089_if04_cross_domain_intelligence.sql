-- IF-04 Cross-domain Intelligence: trusted write boundary over the existing canonical ledger.
-- No new table and no domain_key is assigned: this is a cross-domain analysis, not one single-domain record.
create or replace function public.create_cross_domain_intelligence_record(
  p_workspace_id uuid,
  p_summary text,
  p_structured_output jsonb,
  p_operation_id uuid default null,
  p_provider_id text default null
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
  v_domains text[] := array[]::text[];
  v_evidence_ids text[] := array[]::text[];
  v_id text;
begin
  if (select auth.uid()) is null then
    raise exception 'create_cross_domain_intelligence_record: authentication required';
  end if;
  if not public.has_feature((select auth.uid()), 'domain_intelligence') then
    raise exception 'create_cross_domain_intelligence_record: cross-domain intelligence requires an entitled plan';
  end if;
  if p_summary is null or length(trim(p_summary)) = 0 then
    raise exception 'create_cross_domain_intelligence_record: summary is required';
  end if;
  if p_structured_output is null
     or jsonb_typeof(p_structured_output) is distinct from 'object'
     or p_structured_output ->> 'schemaVersion' is distinct from '1'
     or p_structured_output -> 'crossDomain' is distinct from 'true'::jsonb
     or jsonb_typeof(p_structured_output -> 'domains') is distinct from 'array'
     or jsonb_typeof(p_structured_output -> 'evidence') is distinct from 'array'
     or jsonb_typeof(p_structured_output -> 'findings') is distinct from 'array'
     or jsonb_typeof(p_structured_output -> 'recommendations') is distinct from 'array' then
    raise exception 'create_cross_domain_intelligence_record: invalid IF-04 output envelope';
  end if;

  for v_item in select value from jsonb_array_elements(p_structured_output -> 'domains') as d(value) loop
    if jsonb_typeof(v_item) is distinct from 'string' or v_item #>> '{}' not in ('finance','marketing','sales','operations','hr','legal','customer','risk') then
      raise exception 'create_cross_domain_intelligence_record: invalid domain key';
    end if;
    v_id := v_item #>> '{}';
    if v_id = any(v_domains) then raise exception 'create_cross_domain_intelligence_record: domain keys must be unique'; end if;
    v_domains := array_append(v_domains, v_id);
  end loop;
  if cardinality(v_domains) < 2 then raise exception 'create_cross_domain_intelligence_record: at least two distinct domains are required'; end if;

  for v_item in select value from jsonb_array_elements(p_structured_output -> 'evidence') as e(value) loop
    if jsonb_typeof(v_item) is distinct from 'object'
       or nullif(btrim(v_item ->> 'id'), '') is null
       or nullif(btrim(v_item ->> 'statement'), '') is null
       or v_item ->> 'kind' is null
       or v_item ->> 'kind' not in ('verified_fact','deterministic_calculation','assumption','hypothesis','recommendation')
       or nullif(btrim(v_item ->> 'sourceRef'), '') is null
       or jsonb_typeof(v_item -> 'sourceRef') is distinct from 'string'
       or not (v_item ? 'confidence')
       or jsonb_typeof(v_item -> 'confidence') not in ('null','number') then
      raise exception 'create_cross_domain_intelligence_record: malformed evidence';
    end if;
    if jsonb_typeof(v_item -> 'confidence') = 'number' and ((v_item ->> 'confidence')::numeric < 0 or (v_item ->> 'confidence')::numeric > 1) then
      raise exception 'create_cross_domain_intelligence_record: evidence confidence must be between 0 and 1';
    end if;
    v_id := v_item ->> 'id';
    if v_id = any(v_evidence_ids) then raise exception 'create_cross_domain_intelligence_record: evidence ids must be unique'; end if;
    v_evidence_ids := array_append(v_evidence_ids, v_id);
  end loop;

  for v_entry in select value from jsonb_array_elements(p_structured_output -> 'findings') as f(value) loop
    if jsonb_typeof(v_entry) is distinct from 'object'
       or nullif(btrim(v_entry ->> 'id'), '') is null
       or nullif(btrim(v_entry ->> 'statement'), '') is null
       or jsonb_typeof(v_entry -> 'evidenceIds') is distinct from 'array' then
      raise exception 'create_cross_domain_intelligence_record: malformed finding';
    end if;
    for v_ref in select value from jsonb_array_elements(v_entry -> 'evidenceIds') as r(value) loop
      if jsonb_typeof(v_ref) is distinct from 'string' or not ((v_ref #>> '{}') = any(v_evidence_ids)) then
        raise exception 'create_cross_domain_intelligence_record: finding references unknown evidence';
      end if;
    end loop;
  end loop;

  for v_entry in select value from jsonb_array_elements(p_structured_output -> 'recommendations') as r(value) loop
    if jsonb_typeof(v_entry) is distinct from 'object'
       or nullif(btrim(v_entry ->> 'id'), '') is null
       or nullif(btrim(v_entry ->> 'statement'), '') is null
       or jsonb_typeof(v_entry -> 'evidenceIds') is distinct from 'array'
       or (v_entry -> 'requiresApproval') is distinct from 'true'::jsonb then
      raise exception 'create_cross_domain_intelligence_record: recommendation must be valid and require approval';
    end if;
    for v_ref in select value from jsonb_array_elements(v_entry -> 'evidenceIds') as r(value) loop
      if jsonb_typeof(v_ref) is distinct from 'string' or not ((v_ref #>> '{}') = any(v_evidence_ids)) then
        raise exception 'create_cross_domain_intelligence_record: recommendation references unknown evidence';
      end if;
    end loop;
  end loop;

  select * into v_record from public.create_intelligence_record(
    p_workspace_id, null, 'analysis', p_summary, p_structured_output, 'completed', null,
    p_operation_id, p_provider_id, null, null, null, null
  );
  return v_record;
end;
$$;

revoke all on function public.create_cross_domain_intelligence_record(uuid, text, jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.create_cross_domain_intelligence_record(uuid, text, jsonb, uuid, text) to authenticated;