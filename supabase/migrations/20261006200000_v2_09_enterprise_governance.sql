-- ARRIYIA V2-09 — Enterprise Governance control plane.
-- Governance defines policy and resource bindings. No runtime is introduced.
-- NoVA Core remains execution authority.

create table if not exists public.v2_governance_policies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null,
  name text not null,
  slug text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  autonomy_ceiling text not null default 'recommend' check (autonomy_ceiling in ('inform','recommend','prepare','bounded')),
  approval_mode text not null default 'consequential' check (approval_mode in ('never','consequential','always')),
  allowed_tool_scopes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v2_governance_policy_name_not_blank check (length(trim(name)) > 0),
  constraint v2_governance_policy_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  constraint v2_governance_policy_tools_array check (jsonb_typeof(allowed_tool_scopes) = 'array')
);

create unique index if not exists v2_governance_policies_workspace_slug_uidx on public.v2_governance_policies(workspace_id, slug);
create index if not exists v2_governance_policies_workspace_idx on public.v2_governance_policies(workspace_id, updated_at desc);

create table if not exists public.v2_agent_governance (
  policy_id uuid not null references public.v2_governance_policies(id) on delete cascade,
  agent_id uuid not null references public.v2_agents(id) on delete cascade,
  autonomy_ceiling text check (autonomy_ceiling is null or autonomy_ceiling in ('inform','recommend','prepare','bounded')),
  approval_mode text check (approval_mode is null or approval_mode in ('never','consequential','always')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(policy_id, agent_id)
);

create table if not exists public.v2_workflow_governance (
  policy_id uuid not null references public.v2_governance_policies(id) on delete cascade,
  workflow_id uuid not null references public.v2_workflows(id) on delete cascade,
  autonomy_ceiling text check (autonomy_ceiling is null or autonomy_ceiling in ('inform','recommend','prepare','bounded')),
  approval_mode text check (approval_mode is null or approval_mode in ('never','consequential','always')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(policy_id, workflow_id)
);

create or replace function public.v2_governance_access(p_policy_id uuid, p_min_role text default 'viewer')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.v2_governance_policies p
    where p.id = p_policy_id and public.has_workspace_role(p.workspace_id, p_min_role)
  );
$$;

revoke execute on function public.v2_governance_access(uuid,text) from anon, public;
grant execute on function public.v2_governance_access(uuid,text) to authenticated;

alter table public.v2_governance_policies enable row level security;
alter table public.v2_agent_governance enable row level security;
alter table public.v2_workflow_governance enable row level security;

drop policy if exists "V2 governance policies readable in space" on public.v2_governance_policies;
create policy "V2 governance policies readable in space" on public.v2_governance_policies for select using (public.v2_governance_access(id, 'viewer'));

drop policy if exists "V2 agent governance readable in space" on public.v2_agent_governance;
create policy "V2 agent governance readable in space" on public.v2_agent_governance for select using (public.v2_governance_access(policy_id, 'viewer'));

drop policy if exists "V2 workflow governance readable in space" on public.v2_workflow_governance;
create policy "V2 workflow governance readable in space" on public.v2_workflow_governance for select using (public.v2_governance_access(policy_id, 'viewer'));

create or replace function public.v2_create_governance_policy(p_workspace_id uuid,p_name text,p_slug text,p_description text default '')
returns public.v2_governance_policies language plpgsql security definer set search_path = public as $$
declare result_row public.v2_governance_policies; v_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_workspace_role(p_workspace_id, 'editor') then raise exception 'Workspace editor access required'; end if;
  select v2_organization_id into v_org from public.workspaces where id=p_workspace_id and v2_kind='business' and v2_subscription='enterprise' and v2_status='active';
  if v_org is null then raise exception 'Active ARRIYIA Business Space required'; end if;
  insert into public.v2_governance_policies(owner_user_id,workspace_id,organization_id,name,slug,description)
  values(auth.uid(),p_workspace_id,v_org,trim(p_name),lower(trim(p_slug)),coalesce(p_description,''))
  returning * into result_row;
  return result_row;
exception when unique_violation then raise exception 'A governance policy with this slug already exists in this Space';
end; $$;

create or replace function public.v2_set_governance_policy_status(p_policy_id uuid,p_status text)
returns public.v2_governance_policies language plpgsql security definer set search_path = public as $$
declare result_row public.v2_governance_policies;
begin
  if not public.v2_governance_access(p_policy_id,'owner') then raise exception 'Only the Business Space owner can change governance policy status'; end if;
  if p_status not in ('draft','active','paused','archived') then raise exception 'Unsupported governance policy status'; end if;
  update public.v2_governance_policies set status=p_status,updated_at=now() where id=p_policy_id returning * into result_row;
  return result_row;
end; $$;

create or replace function public.v2_update_governance_policy(p_policy_id uuid,p_autonomy_ceiling text,p_approval_mode text,p_allowed_tool_scopes jsonb)
returns public.v2_governance_policies language plpgsql security definer set search_path = public as $$
declare result_row public.v2_governance_policies;
begin
  if not public.v2_governance_access(p_policy_id,'owner') then raise exception 'Only the Business Space owner can update governance policy'; end if;
  if p_autonomy_ceiling not in ('inform','recommend','prepare','bounded') then raise exception 'Unsupported autonomy ceiling'; end if;
  if p_approval_mode not in ('never','consequential','always') then raise exception 'Unsupported approval mode'; end if;
  if jsonb_typeof(p_allowed_tool_scopes) <> 'array' then raise exception 'Allowed tool scopes must be an array'; end if;
  update public.v2_governance_policies set autonomy_ceiling=p_autonomy_ceiling,approval_mode=p_approval_mode,allowed_tool_scopes=p_allowed_tool_scopes,updated_at=now() where id=p_policy_id returning * into result_row;
  return result_row;
end; $$;

create or replace function public.v2_bind_agent_governance(p_policy_id uuid,p_agent_id uuid,p_autonomy_ceiling text default null,p_approval_mode text default null)
returns public.v2_agent_governance language plpgsql security definer set search_path = public as $$
declare result_row public.v2_agent_governance; policy_ws uuid; agent_ws uuid;
begin
  if not public.v2_governance_access(p_policy_id,'owner') then raise exception 'Governance policy owner access required'; end if;
  select workspace_id into policy_ws from public.v2_governance_policies where id=p_policy_id;
  select workspace_id into agent_ws from public.v2_agents where id=p_agent_id;
  if policy_ws is null or agent_ws is null or policy_ws <> agent_ws then raise exception 'Governance policy and agent must belong to the same Space'; end if;
  insert into public.v2_agent_governance(policy_id,agent_id,autonomy_ceiling,approval_mode)
  values(p_policy_id,p_agent_id,p_autonomy_ceiling,p_approval_mode)
  on conflict(policy_id,agent_id) do update set autonomy_ceiling=excluded.autonomy_ceiling,approval_mode=excluded.approval_mode,enabled=true,updated_at=now()
  returning * into result_row;
  return result_row;
end; $$;

create or replace function public.v2_bind_workflow_governance(p_policy_id uuid,p_workflow_id uuid,p_autonomy_ceiling text default null,p_approval_mode text default null)
returns public.v2_workflow_governance language plpgsql security definer set search_path = public as $$
declare result_row public.v2_workflow_governance; policy_ws uuid; workflow_ws uuid;
begin
  if not public.v2_governance_access(p_policy_id,'owner') then raise exception 'Governance policy owner access required'; end if;
  select workspace_id into policy_ws from public.v2_governance_policies where id=p_policy_id;
  select workspace_id into workflow_ws from public.v2_workflows where id=p_workflow_id;
  if policy_ws is null or workflow_ws is null or policy_ws <> workflow_ws then raise exception 'Governance policy and workflow must belong to the same Space'; end if;
  insert into public.v2_workflow_governance(policy_id,workflow_id,autonomy_ceiling,approval_mode)
  values(p_policy_id,p_workflow_id,p_autonomy_ceiling,p_approval_mode)
  on conflict(policy_id,workflow_id) do update set autonomy_ceiling=excluded.autonomy_ceiling,approval_mode=excluded.approval_mode,enabled=true,updated_at=now()
  returning * into result_row;
  return result_row;
end; $$;

revoke execute on function public.v2_create_governance_policy(uuid,text,text,text) from anon, public;
revoke execute on function public.v2_set_governance_policy_status(uuid,text) from anon, public;
revoke execute on function public.v2_update_governance_policy(uuid,text,text,jsonb) from anon, public;
revoke execute on function public.v2_bind_agent_governance(uuid,uuid,text,text) from anon, public;
revoke execute on function public.v2_bind_workflow_governance(uuid,uuid,text,text) from anon, public;
grant execute on function public.v2_create_governance_policy(uuid,text,text,text) to authenticated;
grant execute on function public.v2_set_governance_policy_status(uuid,text) to authenticated;
grant execute on function public.v2_update_governance_policy(uuid,text,text,jsonb) to authenticated;
grant execute on function public.v2_bind_agent_governance(uuid,uuid,text,text) to authenticated;
grant execute on function public.v2_bind_workflow_governance(uuid,uuid,text,text) to authenticated;
