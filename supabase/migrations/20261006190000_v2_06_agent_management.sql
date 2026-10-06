-- ARRIYIA V2-06 — Agent Management control-plane foundation.
-- Durable agent definitions and versions. No execution runtime is introduced.
-- Execution remains delegated through the NoVA Core boundary.

create table if not exists public.v2_agents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid null references public.workspaces(id) on delete cascade,
  organization_id uuid null,
  name text not null,
  slug text not null,
  description text not null default '',
  status text not null default 'draft'
    check (status in ('draft','validated','active','paused','archived')),
  active_version integer null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_agents_name_not_blank check (length(trim(name)) > 0),
  constraint v2_agents_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  constraint v2_agents_personal_or_business check (
    (workspace_id is null and organization_id is null)
    or (workspace_id is not null and organization_id is not null)
  )
);

create unique index if not exists v2_agents_personal_slug_uidx
  on public.v2_agents (owner_user_id, slug)
  where workspace_id is null;

create unique index if not exists v2_agents_workspace_slug_uidx
  on public.v2_agents (workspace_id, slug)
  where workspace_id is not null;

create index if not exists v2_agents_workspace_idx
  on public.v2_agents (workspace_id, updated_at desc);

create table if not exists public.v2_agent_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.v2_agents(id) on delete cascade,
  version integer not null,
  status text not null default 'draft'
    check (status in ('draft','validated','active','retired')),
  definition jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint v2_agent_versions_version_positive check (version > 0),
  constraint v2_agent_versions_definition_object check (jsonb_typeof(definition) = 'object'),
  unique (agent_id, version)
);

create index if not exists v2_agent_versions_agent_idx
  on public.v2_agent_versions (agent_id, version desc);

create or replace function public.v2_agent_access(p_agent_id uuid, p_min_role text default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.v2_agents a
    where a.id = p_agent_id
      and (
        (a.workspace_id is null and a.owner_user_id = auth.uid())
        or (
          a.workspace_id is not null
          and public.has_workspace_role(a.workspace_id, p_min_role)
        )
      )
  );
$$;

grant execute on function public.v2_agent_access(uuid, text) to authenticated;

alter table public.v2_agents enable row level security;
alter table public.v2_agent_versions enable row level security;

drop policy if exists "V2 agents readable in space" on public.v2_agents;
create policy "V2 agents readable in space"
  on public.v2_agents for select
  using (public.v2_agent_access(id, 'viewer'));

drop policy if exists "V2 agent versions readable in space" on public.v2_agent_versions;
create policy "V2 agent versions readable in space"
  on public.v2_agent_versions for select
  using (public.v2_agent_access(agent_id, 'viewer'));

-- All lifecycle writes go through the RPCs below; there are intentionally no
-- direct client INSERT/DELETE policies on either control-plane table.

create or replace function public.v2_create_agent(
  p_workspace_id uuid,
  p_name text,
  p_slug text,
  p_description text default ''
)
returns public.v2_agents
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.v2_agents;
  v_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_workspace_id is not null then
    if not public.has_workspace_role(p_workspace_id, 'editor') then
      raise exception 'Workspace editor access required';
    end if;
    select w.v2_organization_id into v_org
      from public.workspaces w
     where w.id = p_workspace_id
       and w.v2_kind = 'business'
       and w.v2_subscription = 'enterprise'
       and w.v2_status = 'active';
    if v_org is null then
      raise exception 'Active ARRIYIA Business Space required';
    end if;
  end if;

  insert into public.v2_agents(
    owner_user_id, workspace_id, organization_id, name, slug, description
  )
  values (
    auth.uid(), p_workspace_id, v_org, trim(p_name), lower(trim(p_slug)), coalesce(p_description, '')
  )
  returning * into result;

  insert into public.v2_agent_versions(agent_id, version, definition, created_by)
  values (
    result.id, 1,
    jsonb_build_object(
      'version', 1,
      'systemPurpose', trim(p_description),
      'capabilities', '[]'::jsonb,
      'toolIds', '[]'::jsonb,
      'memoryScopes', case when p_workspace_id is null then '["personal"]'::jsonb else '["workspace"]'::jsonb end,
      'policyIds', '[]'::jsonb,
      'autonomy', 'supervised'
    ),
    auth.uid()
  );

  return result;
exception
  when unique_violation then
    raise exception 'An agent with this slug already exists in this Space';
end;
$$;

create or replace function public.v2_save_agent_version(
  p_agent_id uuid,
  p_definition jsonb
)
returns public.v2_agent_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.v2_agent_versions;
  v_next integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.v2_agent_access(p_agent_id, 'editor') then
    raise exception 'Agent editor access required';
  end if;
  if jsonb_typeof(p_definition) <> 'object' then
    raise exception 'Agent definition must be a JSON object';
  end if;
  if not (p_definition ? 'systemPurpose')
     or jsonb_typeof(p_definition->'systemPurpose') <> 'string'
     or length(trim(p_definition->>'systemPurpose')) = 0 then
    raise exception 'Agent definition requires systemPurpose';
  end if;
  if not (p_definition ? 'capabilities')
     or jsonb_typeof(p_definition->'capabilities') <> 'array' then
    raise exception 'Agent definition requires capabilities[]';
  end if;
  if not (p_definition ? 'toolIds')
     or jsonb_typeof(p_definition->'toolIds') <> 'array' then
    raise exception 'Agent definition requires toolIds[]';
  end if;
  if not (p_definition ? 'memoryScopes')
     or jsonb_typeof(p_definition->'memoryScopes') <> 'array' then
    raise exception 'Agent definition requires memoryScopes[]';
  end if;
  if not (p_definition ? 'policyIds')
     or jsonb_typeof(p_definition->'policyIds') <> 'array' then
    raise exception 'Agent definition requires policyIds[]';
  end if;

  select coalesce(max(version), 0) + 1 into v_next
    from public.v2_agent_versions
   where agent_id = p_agent_id;

  insert into public.v2_agent_versions(agent_id, version, definition, created_by)
  values (p_agent_id, v_next, jsonb_set(p_definition, '{version}', to_jsonb(v_next), true), auth.uid())
  returning * into result;

  update public.v2_agent_versions
     set status = 'retired'
   where agent_id = p_agent_id and status in ('active','validated');

  update public.v2_agents
     set status = 'draft',
         active_version = null,
         updated_at = now()
   where id = p_agent_id;

  return result;
end;
$$;

create or replace function public.v2_validate_agent(p_agent_id uuid)
returns public.v2_agent_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.v2_agent_versions;
begin
  if not public.v2_agent_access(p_agent_id, 'editor') then
    raise exception 'Agent editor access required';
  end if;

  select * into result
    from public.v2_agent_versions
   where agent_id = p_agent_id
   order by version desc
   limit 1;

  if result.id is null then raise exception 'Agent has no definition version'; end if;

  if jsonb_array_length(result.definition->'capabilities') < 1 then
    raise exception 'Agent requires at least one capability';
  end if;

  update public.v2_agent_versions
     set status = 'validated'
   where id = result.id
   returning * into result;

  update public.v2_agents
     set status = 'validated',
         updated_at = now()
   where id = p_agent_id;

  return result;
end;
$$;

create or replace function public.v2_set_agent_status(
  p_agent_id uuid,
  p_status text
)
returns public.v2_agents
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.v2_agents;
  v_latest public.v2_agent_versions;
begin
  if not public.v2_agent_access(p_agent_id, 'editor') then
    raise exception 'Agent editor access required';
  end if;

  if p_status not in ('draft','validated','active','paused','archived') then
    raise exception 'Unsupported agent status';
  end if;

  select * into result from public.v2_agents where id = p_agent_id;
  select * into v_latest from public.v2_agent_versions where agent_id = p_agent_id order by version desc limit 1;

  if p_status = 'active' then
    if result.workspace_id is not null then
      if not public.has_workspace_role(result.workspace_id, 'owner') then
        raise exception 'Only the Business Space owner can activate an agent';
      end if;
    end if;
    if v_latest.id is null or v_latest.status <> 'validated' then
      raise exception 'Agent must be validated before activation';
    end if;

    update public.v2_agent_versions
       set status = case when id = v_latest.id then 'active' else 'retired' end
     where agent_id = p_agent_id;

    update public.v2_agents
       set status = 'active',
           active_version = v_latest.version,
           updated_at = now()
     where id = p_agent_id;
  elsif p_status = 'paused' then
    update public.v2_agents
       set status = 'paused', updated_at = now()
     where id = p_agent_id;
  elsif p_status = 'archived' then
    update public.v2_agents
       set status = 'archived', updated_at = now()
     where id = p_agent_id;
  elsif p_status = 'validated' then
    if v_latest.id is null or v_latest.status <> 'validated' then
      raise exception 'Validate the latest definition before selecting validated';
    end if;
    update public.v2_agents set status = 'validated', updated_at = now() where id = p_agent_id;
  else
    update public.v2_agent_versions
       set status = 'retired'
     where agent_id = p_agent_id and status = 'active';
    update public.v2_agents
       set status = 'draft', active_version = null, updated_at = now()
     where id = p_agent_id;
  end if;

  select * into result from public.v2_agents where id = p_agent_id;
  return result;
end;
$$;

grant execute on function public.v2_create_agent(uuid, text, text, text) to authenticated;
grant execute on function public.v2_save_agent_version(uuid, jsonb) to authenticated;
grant execute on function public.v2_validate_agent(uuid) to authenticated;
grant execute on function public.v2_set_agent_status(uuid, text) to authenticated;

create or replace function public.v2_touch_agent_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists v2_agents_updated_at on public.v2_agents;
create trigger v2_agents_updated_at
before update on public.v2_agents
for each row execute function public.v2_touch_agent_updated_at();
