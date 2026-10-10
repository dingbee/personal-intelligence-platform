-- IF-02 shared foundation security regressions.
-- Safe test identities used by the existing ledger security suite:
-- user A: 23c725ec-b2d6-487c-8291-dae7a280a291
-- user B: 313866d5-4ab7-4d65-bda9-67b9bd668f2d
-- Run against an isolated migrated Supabase-compatible test database only.

begin;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';

do $$
declare
  v_record public.intelligence_records;
  v_journey public.intelligence_journeys;
  v_conversation_id uuid;
  v_workspace_a uuid;
  v_workspace_b uuid;
  v_objective_id uuid;
  v_raised boolean;
begin
  -- Shared contract: domain identity is independent of engine record_type.
  select * into v_record from public.create_domain_intelligence_record(
    'finance', null, null, 'analysis', 'IF-02 valid domain record',
    '{"evidence":[],"findings":[]}'::jsonb
  );
  if v_record.domain_key <> 'finance' or v_record.record_type <> 'analysis' then
    raise exception 'IF-02 TEST FAILED (1): domain_key and record_type were conflated or not persisted';
  end if;

  v_raised := false;
  begin
    perform public.create_domain_intelligence_record(
      'not-a-domain', null, null, 'analysis', 'Invalid domain', '{}'::jsonb
    );
  exception when others then v_raised := true;
  end;
  if not v_raised then
    raise exception 'IF-02 TEST FAILED (2): invalid domain_key was accepted';
  end if;

  v_raised := false;
  begin
    perform public.create_domain_intelligence_record(
      'risk', null, null, 'analysis', 'Invalid output shape', '[]'::jsonb
    );
  exception when others then v_raised := true;
  end;
  if not v_raised then
    raise exception 'IF-02 TEST FAILED (3): non-object structured_output was accepted';
  end if;

  -- A's conversation is valid only for A and only in the same workspace scope.
  insert into public.conversations (user_id, workspace_id, title)
  values ('23c725ec-b2d6-487c-8291-dae7a280a291', null, 'IF-02 owner conversation')
  returning id into v_conversation_id;
  select * into v_record from public.create_intelligence_record(
    null, null, 'analysis', 'Own conversation accepted', '{}'::jsonb,
    'completed', null, null, null, v_conversation_id
  );

  -- Prepare an objective owned by A in workspace A.
  insert into public.workspaces (user_id, name)
  values ('23c725ec-b2d6-487c-8291-dae7a280a291', 'IF-02 workspace A')
  returning id into v_workspace_a;
  insert into public.workspaces (user_id, name)
  values ('23c725ec-b2d6-487c-8291-dae7a280a291', 'IF-02 workspace B')
  returning id into v_workspace_b;
  insert into public.workspace_objectives (workspace_id, user_id, content)
  values (v_workspace_a, '23c725ec-b2d6-487c-8291-dae7a280a291', 'IF-02 objective')
  returning id into v_objective_id;

  v_raised := false;
  begin
    perform public.create_intelligence_journey(null, v_objective_id, 'Personal journey with workspace objective');
  exception when others then v_raised := true;
  end;
  if not v_raised then
    raise exception 'IF-02 TEST FAILED (4): personal journey accepted a workspace objective';
  end if;

  v_raised := false;
  begin
    perform public.create_intelligence_journey(v_workspace_b, v_objective_id, 'Cross-workspace objective');
  exception when others then v_raised := true;
  end;
  if not v_raised then
    raise exception 'IF-02 TEST FAILED (5): journey accepted objective from another workspace';
  end if;

  select * into v_journey from public.create_intelligence_journey(v_workspace_a, v_objective_id, 'Valid same-workspace objective');
  if v_journey.id is null then
    raise exception 'IF-02 TEST FAILED (6): valid owner/same-workspace objective was rejected';
  end if;

  raise notice 'IF-02 TESTS (1-6) PASSED: domain identity, JSON shape, conversation owner, and objective scope';
end;
$$;
rollback;

-- Cross-user conversation attack: user A knows B's conversation UUID.
begin;
set local "request.jwt.claims" = '{"sub":"313866d5-4ab7-4d65-bda9-67b9bd668f2d","role":"authenticated"}';
do $$
declare v_conversation_id uuid;
begin
  insert into public.conversations (user_id, workspace_id, title)
  values ('313866d5-4ab7-4d65-bda9-67b9bd668f2d', null, 'IF-02 user B private conversation')
  returning id into v_conversation_id;
  perform set_config('app.if02_private_conversation_id', v_conversation_id::text, true);
end;
$$;
set local "request.jwt.claims" = '{"sub":"23c725ec-b2d6-487c-8291-dae7a280a291","role":"authenticated"}';
do $$
declare v_raised boolean := false;
begin
  begin
    perform public.create_intelligence_record(
      null, null, 'analysis', 'Attempt to attach another user conversation', '{}'::jsonb,
      'completed', null, null, null, current_setting('app.if02_private_conversation_id')::uuid
    );
  exception when others then v_raised := true;
  end;
  if not v_raised then
    raise exception 'IF-02 TEST FAILED (7): another user''s conversation was accepted';
  end if;
  raise notice 'IF-02 TEST (7) PASSED: cross-user conversation attachment rejected';
end;
$$;
rollback;
