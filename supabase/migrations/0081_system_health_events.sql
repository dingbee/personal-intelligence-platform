-- #21 Phase 5 — Unified Admin Intelligence / Error Centre.
--
-- system_health_events is the single, admin-only, cross-domain operational
-- event sink (AUTH/AI/DOCUMENTS/BILLING/COLLABORATION/SYSTEM). It follows
-- founding_pro_events' precedent (0052_founding_pro_programme_foundation.sql)
-- for shape — narrow known columns + a jsonb metadata catch-all — but is NOT
-- append-only like that table, since admin acknowledge/resolve/reopen
-- actions are an explicit requirement here, not merely an audit trail.
--
-- Zero client grants, matching subscription_events/founding_pro_events: RLS
-- is enabled with no policies at all, and table privileges are revoked from
-- anon/authenticated, so an ordinary user cannot read, insert, or mutate a
-- row under any circumstance, regardless of RLS. The only access paths are
-- the SECURITY DEFINER functions below, each re-checking is_platform_admin()
-- for every admin action (list/summary/acknowledge/resolve/reopen), exactly
-- like every existing admin_* RPC in this codebase (see 0035, 0041, 0054).
--
-- Two write paths, deliberately asymmetric in privilege:
--   - report_system_health_event(): full-privilege producer, granted ONLY to
--     service_role. This is what Edge Functions (ai-chat, pesapal-checkout,
--     pesapal-ipn, send-workspace-invitation, google-drive-*) call using
--     their existing service-role client, the same one pesapal-checkout
--     already uses to write pesapal_checkout_orders directly.
--   - report_document_processing_failure(): a narrow, purpose-built RPC
--     granted to `authenticated`, used by the client-side processDocument.ts
--     pipeline (which has no service-role access). It cannot report an
--     arbitrary category/severity/user — it only lets a user report that
--     THEIR OWN document (ownership re-checked server-side) failed
--     processing, which is already visible to that user via
--     documents.status/processing_jobs.error_message. This satisfies "no
--     fake admin events" without blocking the one legitimate client-side
--     producer this system needs.

create table public.system_health_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  severity text not null check (severity in ('info', 'warning', 'error', 'critical')),
  category text not null check (category in ('auth', 'ai', 'documents', 'billing', 'collaboration', 'system')),
  operation text not null,
  error_code text,
  message text not null,
  diagnosis text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved', 'ignored')),
  user_id uuid references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  provider text,
  metadata jsonb not null default '{}'::jsonb,
  occurrence_count int not null default 1,
  last_occurred_at timestamptz not null default now(),
  dedup_key text not null,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id)
);

create index system_health_events_category_idx on public.system_health_events (category);
create index system_health_events_severity_idx on public.system_health_events (severity);
create index system_health_events_status_idx on public.system_health_events (status);
create index system_health_events_created_at_idx on public.system_health_events (created_at desc);
create index system_health_events_user_id_idx on public.system_health_events (user_id);
create index system_health_events_dedup_lookup_idx on public.system_health_events (dedup_key, status, last_occurred_at);

alter table public.system_health_events enable row level security;
revoke select, insert, update, delete, truncate on public.system_health_events from anon, authenticated;

-- Full-privilege producer. Deduplicates: an identical (category, operation,
-- error_code, user_id, workspace_id) failure that is still OPEN and last
-- occurred within p_dedup_window increments occurrence_count/last_occurred_at
-- in place instead of creating a new row. A failure that recurs AFTER the
-- prior occurrence was resolved, or after the window elapsed, or that
-- differs on any dedup dimension, always creates a fresh row — resolved
-- history is never silently overwritten, and materially different failures
-- are never hidden behind an unrelated one's counter.
create function public.report_system_health_event(
  p_severity text,
  p_category text,
  p_operation text,
  p_message text,
  p_error_code text default null,
  p_diagnosis text default null,
  p_user_id uuid default null,
  p_workspace_id uuid default null,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_provider text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_dedup_window interval default interval '15 minutes'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dedup_key text;
  v_event_id uuid;
begin
  if p_severity not in ('info', 'warning', 'error', 'critical') then
    raise exception 'Invalid severity: %', p_severity;
  end if;
  if p_category not in ('auth', 'ai', 'documents', 'billing', 'collaboration', 'system') then
    raise exception 'Invalid category: %', p_category;
  end if;
  if p_operation is null or length(trim(p_operation)) = 0 then
    raise exception 'operation is required';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'message is required';
  end if;

  v_dedup_key := p_category || ':' || p_operation || ':' || coalesce(p_error_code, '') || ':' || coalesce(p_user_id::text, '') || ':' || coalesce(p_workspace_id::text, '');

  update public.system_health_events
  set occurrence_count = occurrence_count + 1,
      last_occurred_at = now(),
      message = p_message,
      diagnosis = coalesce(p_diagnosis, diagnosis),
      metadata = p_metadata
  where dedup_key = v_dedup_key
    and status = 'open'
    and last_occurred_at > now() - p_dedup_window
  returning id into v_event_id;

  if v_event_id is not null then
    return v_event_id;
  end if;

  insert into public.system_health_events (
    severity, category, operation, error_code, message, diagnosis,
    user_id, workspace_id, related_entity_type, related_entity_id, provider, metadata, dedup_key
  )
  values (
    p_severity, p_category, p_operation, p_error_code, p_message, p_diagnosis,
    p_user_id, p_workspace_id, p_related_entity_type, p_related_entity_id, p_provider, p_metadata, v_dedup_key
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke execute on function public.report_system_health_event(text, text, text, text, text, text, uuid, uuid, text, uuid, text, jsonb, interval) from public;
revoke execute on function public.report_system_health_event(text, text, text, text, text, text, uuid, uuid, text, uuid, text, jsonb, interval) from anon;
grant execute on function public.report_system_health_event(text, text, text, text, text, text, uuid, uuid, text, uuid, text, jsonb, interval) to service_role;

-- Narrow client-side producer — see header comment. Ownership of the
-- document is re-checked server-side; the caller cannot name a different
-- user, category, or severity.
create function public.report_document_processing_failure(p_document_id uuid, p_error_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_workspace_id uuid;
begin
  select user_id, workspace_id into v_owner, v_workspace_id
  from public.documents
  where id = p_document_id;

  if v_owner is null or v_owner is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;

  return public.report_system_health_event(
    p_severity := 'error',
    p_category := 'documents',
    p_operation := 'document_processing',
    p_message := coalesce(p_error_message, 'Document processing failed'),
    p_error_code := null,
    p_diagnosis := null,
    p_user_id := auth.uid(),
    p_workspace_id := v_workspace_id,
    p_related_entity_type := 'document',
    p_related_entity_id := p_document_id,
    p_provider := null,
    p_metadata := jsonb_build_object('document_id', p_document_id)
  );
end;
$$;

revoke execute on function public.report_document_processing_failure(uuid, text) from public;
revoke execute on function public.report_document_processing_failure(uuid, text) from anon;
grant execute on function public.report_document_processing_failure(uuid, text) to authenticated;

-- Admin read/action surface — every function re-checks is_platform_admin()
-- first, matching every existing admin_* RPC in this codebase exactly.

create function public.admin_list_system_health_events(
  p_category text default null,
  p_severity text default null,
  p_status text default null,
  p_since timestamptz default null,
  p_user_id uuid default null,
  p_operation text default null,
  p_provider text default null,
  p_limit int default 200
)
returns setof public.system_health_events
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select *
  from public.system_health_events e
  where (p_category is null or e.category = p_category)
    and (p_severity is null or e.severity = p_severity)
    and (p_status is null or e.status = p_status)
    and (p_since is null or e.last_occurred_at >= p_since)
    and (p_user_id is null or e.user_id = p_user_id)
    and (p_operation is null or e.operation = p_operation)
    and (p_provider is null or e.provider = p_provider)
  order by e.last_occurred_at desc
  limit greatest(p_limit, 0);
end;
$$;

revoke execute on function public.admin_list_system_health_events(text, text, text, timestamptz, uuid, text, text, int) from public;
revoke execute on function public.admin_list_system_health_events(text, text, text, timestamptz, uuid, text, text, int) from anon;
grant execute on function public.admin_list_system_health_events(text, text, text, timestamptz, uuid, text, text, int) to authenticated;

create function public.admin_system_health_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'open_critical', count(*) filter (where status = 'open' and severity = 'critical'),
    'open_error', count(*) filter (where status = 'open' and severity = 'error'),
    'open_warning', count(*) filter (where status = 'open' and severity = 'warning'),
    'events_today', count(*) filter (where created_at >= date_trunc('day', now())),
    'unresolved', count(*) filter (where status in ('open', 'acknowledged'))
  )
  into v_result
  from public.system_health_events;

  return v_result;
end;
$$;

revoke execute on function public.admin_system_health_summary() from public;
revoke execute on function public.admin_system_health_summary() from anon;
grant execute on function public.admin_system_health_summary() to authenticated;

create function public.admin_acknowledge_system_health_event(p_event_id uuid)
returns public.system_health_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.system_health_events;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select * into v_event from public.system_health_events where id = p_event_id for update;
  if v_event.id is null then
    raise exception 'Event not found';
  end if;

  if v_event.status <> 'open' then
    raise exception 'Event must be open to acknowledge (current status: %)', v_event.status;
  end if;

  update public.system_health_events
  set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = auth.uid()
  where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

revoke execute on function public.admin_acknowledge_system_health_event(uuid) from public;
revoke execute on function public.admin_acknowledge_system_health_event(uuid) from anon;
grant execute on function public.admin_acknowledge_system_health_event(uuid) to authenticated;

-- Idempotent: calling resolve on an already-resolved event is a no-op that
-- returns the event unchanged, rather than raising — matching the task's
-- "idempotent where appropriate" instruction for admin interventions.
create function public.admin_resolve_system_health_event(p_event_id uuid, p_resolution_note text default null)
returns public.system_health_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.system_health_events;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select * into v_event from public.system_health_events where id = p_event_id for update;
  if v_event.id is null then
    raise exception 'Event not found';
  end if;

  if v_event.status = 'resolved' then
    return v_event;
  end if;

  update public.system_health_events
  set status = 'resolved',
      resolved_at = now(),
      resolved_by = auth.uid(),
      diagnosis = coalesce(p_resolution_note, diagnosis)
  where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

revoke execute on function public.admin_resolve_system_health_event(uuid, text) from public;
revoke execute on function public.admin_resolve_system_health_event(uuid, text) from anon;
grant execute on function public.admin_resolve_system_health_event(uuid, text) to authenticated;

create function public.admin_reopen_system_health_event(p_event_id uuid)
returns public.system_health_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.system_health_events;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select * into v_event from public.system_health_events where id = p_event_id for update;
  if v_event.id is null then
    raise exception 'Event not found';
  end if;

  if v_event.status not in ('resolved', 'ignored') then
    raise exception 'Event must be resolved or ignored to reopen (current status: %)', v_event.status;
  end if;

  update public.system_health_events
  set status = 'open',
      resolved_at = null,
      resolved_by = null,
      acknowledged_at = null,
      acknowledged_by = null,
      last_occurred_at = now()
  where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

revoke execute on function public.admin_reopen_system_health_event(uuid) from public;
revoke execute on function public.admin_reopen_system_health_event(uuid) from anon;
grant execute on function public.admin_reopen_system_health_event(uuid) to authenticated;

create function public.admin_ignore_system_health_event(p_event_id uuid)
returns public.system_health_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.system_health_events;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select * into v_event from public.system_health_events where id = p_event_id for update;
  if v_event.id is null then
    raise exception 'Event not found';
  end if;

  if v_event.status not in ('open', 'acknowledged') then
    raise exception 'Event must be open or acknowledged to ignore (current status: %)', v_event.status;
  end if;

  update public.system_health_events
  set status = 'ignored'
  where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

revoke execute on function public.admin_ignore_system_health_event(uuid) from public;
revoke execute on function public.admin_ignore_system_health_event(uuid) from anon;
grant execute on function public.admin_ignore_system_health_event(uuid) to authenticated;
