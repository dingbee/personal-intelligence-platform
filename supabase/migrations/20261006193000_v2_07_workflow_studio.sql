-- ARRIYIA V2-07 — Workflow Studio control plane.
-- Declarative only. Workflow execution remains a NoVA Core concern.

create table if not exists public.v2_workflows (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null,
  name text not null,
  slug text not null,
  description text not null default '',
  status text not null default 'draft'
    check (status in ('draft','validated','active','paused','archived')),
  active_version integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_workflows_name_not_blank check (length(trim(name)) > 0),
  constraint v2_workflows_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

create unique index if not exists v2_workflows_workspace_slug_uidx
  on public.v2_workflows (workspace_id, slug);

create index if not exists v2_workflows_workspace_idx
  on public.v2_workflows (workspace_id, updated_at desc);

create table if not exists public.v2_workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.v2_workflows(id) on delete cascade,
  version integer not null,
  status text not null default 'draft'
    check (status in ('draft','validated','active','retired')),
  definition jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint v2_workflow_versions_version_positive check (version > 0),
  constraint v2_workflow_versions_definition_object check (jsonb_typeof(definition) = 'object'),
  unique (workflow_id, version)
);

create index if not exists v2_workflow_versions_workflow_idx
  on public.v2_workflow_versions (workflow_id, version desc);

create or replace function public.v2_workflow_access(p_workflow_id uuid, p_min_role text default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.v2_workflows w
    where w.id = p_workflow_id
      and public.has_workspace_role(w.workspace_id, p_min_role)
  );
$$;

revoke execute on function public.v2_workflow_access(uuid, text) from anon, public;
grant execute on function public.v2_workflow_access(uuid, text) to authenticated;

alter table public.v2_workflows enable row level security;
alter table public.v2_workflow_versions enable row level security;

drop policy if exists "V2 workflows readable in space" on public.v2_workflows;
create policy "V2 workflows readable in space"
  on public.v2_workflows for select
  using (public.v2_workflow_access(id, 'viewer'));

drop policy if exists "V2 workflow versions readable in space" on public.v2_workflow_versions;
create policy "V2 workflow versions readable in space"
  on public.v2_workflow_versions for select
  using (public.v2_workflow_access(workflow_id, 'viewer'));

create or replace function public.v2_create_workflow(
  p_workspace_id uuid,
  p_name text,
  p_slug text,
  p_description text default ''
)
returns public.v2_workflows
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.v2_workflows;
  v_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_workspace_id is null then raise exception 'Workflow Studio requires an ARRIYIA Business Space'; end if;
  if not public.has_workspace_role(p_workspace_id, 'editor') then
    raise exception 'Workspace editor access required';
  end if;

  select w.v2_organization_id into v_org
    from public.workspaces w
   where w.id = p_workspace_id
     and w.v2_kind = 'business'
     and w.v2_subscription = 'enterprise'
     and w.v2_status = 'active';

  if v_org is null then raise exception 'Active ARRIYIA Business Space required'; end if;

  insert into public.v2_workflows(owner_user_id, workspace_id, organization_id, name, slug, description)
  values (auth.uid(), p_workspace_id, v_org, trim(p_name), lower(trim(p_slug)), coalesce(p_description, ''))
  returning * into result;

  insert into public.v2_workflow_versions(workflow_id, version, definition, created_by)
  values (
    result.id, 1,
    jsonb_build_object(
      'version', 1,
      'trigger', jsonb_build_object('type','manual'),
      'nodes', jsonb_build_array(
        jsonb_build_object(
          'id','start',
          'type','understand',
          'config',jsonb_build_object('purpose',''),
          'next','[]'::jsonb
        )
      )
    ),
    auth.uid()
  );

  return result;
exception
  when unique_violation then
    raise exception 'A workflow with this slug already exists in this Space';
end;
$$;

create or replace function public.v2_save_workflow_version(
  p_workflow_id uuid,
  p_definition jsonb
)
returns public.v2_workflow_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.v2_workflow_versions;
  v_next integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.v2_workflow_access(p_workflow_id, 'editor') then
    raise exception 'Workflow editor access required';
  end if;
  if jsonb_typeof(p_definition) <> 'object' then
    raise exception 'Workflow definition must be a JSON object';
  end if;
  if jsonb_typeof(p_definition->'trigger') <> 'object' then
    raise exception 'Workflow definition requires trigger{}';
  end if;
  if jsonb_typeof(p_definition->'nodes') <> 'array'
     or jsonb_array_length(p_definition->'nodes') < 1 then
    raise exception 'Workflow definition requires nodes[]';
  end if;

  select coalesce(max(version), 0) + 1 into v_next
    from public.v2_workflow_versions
   where workflow_id = p_workflow_id;

  insert into public.v2_workflow_versions(workflow_id, version, definition, created_by)
  values (
    p_workflow_id,
    v_next,
    jsonb_set(p_definition, '{version}', to_jsonb(v_next), true),
    auth.uid()
  )
  returning * into result;

  update public.v2_workflows
     set status = 'draft', active_version = null, updated_at = now()
   where id = p_workflow_id;

  return result;
end;
$$;

create or replace function public.v2_validate_workflow(p_workflow_id uuid)
returns public.v2_workflow_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.v2_workflow_versions;
  workflow_workspace uuid;
  node jsonb;
  node_id text;
  next_id text;
  node_ids text[] := '{}';
  start_count integer := 0;
  agent_id uuid;
  agent_workspace uuid;
  agent_status text;
begin
  if not public.v2_workflow_access(p_workflow_id, 'editor') then
    raise exception 'Workflow editor access required';
  end if;

  select * into result
    from public.v2_workflow_versions
   where workflow_id = p_workflow_id
   order by version desc
   limit 1;

  if result.id is null then raise exception 'Workflow has no definition version'; end if;

  select workspace_id into workflow_workspace
    from public.v2_workflows where id = p_workflow_id;

  if jsonb_typeof(result.definition->'trigger') <> 'object' then
    raise exception 'Workflow requires trigger{}';
  end if;

  for node in select value from jsonb_array_elements(result.definition->'nodes') loop
    node_id := node->>'id';
    if node_id is null or length(trim(node_id)) = 0 then
      raise exception 'Every workflow node requires an id';
    end if;
    if node_id = any(node_ids) then
      raise exception 'Workflow node ids must be unique: %', node_id;
    end if;
    node_ids := array_append(node_ids, node_id);

    if (node->>'type') = 'start' then start_count := start_count + 1; end if;

    if (node->>'type') = 'agent' then
      begin
        agent_id := (node->'config'->>'agentId')::uuid;
      exception when others then
        raise exception 'Agent node % has an invalid agentId', node_id;
      end;

      select workspace_id, status into agent_workspace, agent_status
        from public.v2_agents where id = agent_id;

      if agent_workspace is null or agent_workspace <> workflow_workspace then
        raise exception 'Agent node % references an agent outside this workflow Space', node_id;
      end if;
      if agent_status <> 'active' then
        raise exception 'Agent node % references an agent that is not active', node_id;
      end if;
    elsif (node->>'type') = 'tool' then
      if coalesce(length(trim(node->'config'->>'toolId')),0) = 0 then
        raise exception 'Tool node % requires toolId', node_id;
      end if;
    elsif (node->>'type') = 'approval' then
      if coalesce(node->'config'->>'mode','') not in ('human','policy') then
        raise exception 'Approval node % requires mode human or policy', node_id;
      end if;
    elsif (node->>'type') = 'action' then
      if coalesce(length(trim(node->'config'->>'actionId')),0) = 0 then
        raise exception 'Action node % requires actionId', node_id;
      end if;
    elsif (node->>'type') not in ('understand','condition','verify','start') then
      raise exception 'Unsupported workflow node type: %', node->>'type';
    end if;

    if jsonb_typeof(node->'next') <> 'array' then
      raise exception 'Workflow node % requires next[]', node_id;
    end if;

    for next_id in select jsonb_array_elements_text(node->'next') loop
      if next_id = node_id then
        raise exception 'Workflow node % cannot point to itself', node_id;
      end if;
    end loop;
  end loop;

  if start_count <> 1 then
    raise exception 'Workflow requires exactly one start node';
  end if;

  for node in select value from jsonb_array_elements(result.definition->'nodes') loop
    for next_id in select jsonb_array_elements_text(node->'next') loop
      if not next_id = any(node_ids) then
        raise exception 'Workflow edge from % references missing node %', node->>'id', next_id;
      end if;
    end loop;
  end loop;

  update public.v2_workflow_versions set status = 'validated'
   where id = result.id
   returning * into result;

  update public.v2_workflows set status = 'validated', updated_at = now()
   where id = p_workflow_id;

  return result;
end;
$$;

create or replace function public.v2_set_workflow_status(
  p_workflow_id uuid,
  p_status text
)
returns public.v2_workflows
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.v2_workflows;
  latest public.v2_workflow_versions;
begin
  if not public.v2_workflow_access(p_workflow_id, 'editor') then
    raise exception 'Workflow editor access required';
  end if;
  if p_status not in ('draft','validated','active','paused','archived') then
    raise exception 'Unsupported workflow status';
  end if;

  select * into result from public.v2_workflows where id = p_workflow_id;
  select * into latest from public.v2_workflow_versions where workflow_id = p_workflow_id order by version desc limit 1;

  if p_status = 'active' then
    if not public.has_workspace_role(result.workspace_id, 'owner') then
      raise exception 'Only the Business Space owner can activate a workflow';
    end if;
    if latest.id is null or latest.status <> 'validated' then
      raise exception 'Workflow must be validated before activation';
    end if;
    update public.v2_workflow_versions
       set status = case when id = latest.id then 'active' else 'retired' end
     where workflow_id = p_workflow_id;
    update public.v2_workflows
       set status='active', active_version=latest.version, updated_at=now()
     where id=p_workflow_id;
  elsif p_status = 'paused' then
    update public.v2_workflow_versions set status='retired'
     where workflow_id=p_workflow_id and status='active';
    update public.v2_workflows set status='paused', active_version=null, updated_at=now()
     where id=p_workflow_id;
  elsif p_status = 'archived' then
    update public.v2_workflow_versions set status='retired'
     where workflow_id=p_workflow_id and status='active';
    update public.v2_workflows set status='archived', active_version=null, updated_at=now()
     where id=p_workflow_id;
  elsif p_status = 'validated' then
    if latest.id is null or latest.status <> 'validated' then
      raise exception 'Validate the latest workflow version first';
    end if;
    update public.v2_workflows set status='validated', updated_at=now() where id=p_workflow_id;
  else
    update public.v2_workflow_versions set status='retired'
     where workflow_id=p_workflow_id and status='active';
    update public.v2_workflows set status='draft', active_version=null, updated_at=now()
     where id=p_workflow_id;
  end if;

  select * into result from public.v2_workflows where id=p_workflow_id;
  return result;
end;
$$;

create or replace function public.v2_touch_workflow_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists v2_workflows_updated_at on public.v2_workflows;
create trigger v2_workflows_updated_at
before update on public.v2_workflows
for each row execute function public.v2_touch_workflow_updated_at();

revoke execute on function public.v2_create_workflow(uuid,text,text,text) from anon, public;
revoke execute on function public.v2_save_workflow_version(uuid,jsonb) from anon, public;
revoke execute on function public.v2_validate_workflow(uuid) from anon, public;
revoke execute on function public.v2_set_workflow_status(uuid,text) from anon, public;
grant execute on function public.v2_create_workflow(uuid,text,text,text) to authenticated;
grant execute on function public.v2_save_workflow_version(uuid,jsonb) to authenticated;
grant execute on function public.v2_validate_workflow(uuid) to authenticated;
grant execute on function public.v2_set_workflow_status(uuid,text) to authenticated;
