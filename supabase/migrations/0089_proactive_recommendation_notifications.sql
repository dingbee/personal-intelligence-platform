-- UX-14.3 — persist and surface the existing Hub recommendation engine.
-- No background jobs, AI calls, or new recommendation logic are introduced.
-- This RPC is the only write path for proactive recommendation notifications.

create or replace function public.persist_proactive_recommendation(
  p_dedupe_key text,
  p_title text,
  p_reason text,
  p_command_id text,
  p_workspace_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if nullif(trim(p_dedupe_key), '') is null then
    raise exception 'Recommendation dedupe key is required';
  end if;

  if nullif(trim(p_title), '') is null or nullif(trim(p_reason), '') is null then
    raise exception 'Recommendation title and reason are required';
  end if;

  -- Do not create the same ambient suggestion repeatedly. A seven-day
  -- window keeps the bell useful without requiring a background cleanup job.
  select id into v_existing
  from public.notifications
  where recipient_user_id = auth.uid()
    and type = 'proactive_recommendation'
    and payload ->> 'dedupe_key' = p_dedupe_key
    and created_at > now() - interval '7 days'
  order by created_at desc
  limit 1;

  if v_existing is not null then
    return v_existing;
  end if;

  insert into public.notifications (recipient_user_id, type, payload)
  values (
    auth.uid(),
    'proactive_recommendation',
    jsonb_build_object(
      'title', p_title,
      'reason', p_reason,
      'command_id', p_command_id,
      'workspace_id', p_workspace_id,
      'dedupe_key', p_dedupe_key,
      'source', 'existing_recommendation_engine'
    )
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.persist_proactive_recommendation(text, text, text, text, uuid) from public, anon;
grant execute on function public.persist_proactive_recommendation(text, text, text, text, uuid) to authenticated, service_role;
