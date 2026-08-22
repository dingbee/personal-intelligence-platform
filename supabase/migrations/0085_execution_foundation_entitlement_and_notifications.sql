-- ARRIYIA — I7 Action/Execution Intelligence: close a real, live gap in
-- 0065_execution_foundation.sql and add ambient notifications.
--
-- GENUINE DEFECT FOUND (I7.23/I7.25): create_execution_request() has NO
-- entitlement check at all. Action generation (runActionIntelligence.ts)
-- is correctly gated on has_feature(user_id, 'action_intelligence'), but
-- that check lives ONLY in the client-side orchestration function for
-- action *proposal* — nothing server-side stops a user without that
-- entitlement from calling create_execution_request() (and from there,
-- authorize_execution_request()/start_execution()/record_execution_attempt(),
-- fully executing an internal capability) directly via the Supabase
-- client, bypassing Action Intelligence's own gate entirely. Verified
-- live against production (pg_get_functiondef) before writing this fix:
-- confirmed the deployed function has no such check.
--
-- FIX: create_execution_request() is re-declared (CREATE OR REPLACE,
-- every existing line of logic preserved verbatim, per this codebase's
-- own established convention for patching a SECURITY DEFINER function —
-- see 0068's own invite_to_workspace re-declaration) with one new check
-- at the top, reusing has_feature() exactly as every other feature gate
-- in this codebase already does (0046) — no second entitlement
-- mechanism. Enforced at the EARLIEST mutation point (request creation)
-- since nothing downstream (authorize/start/record) can happen without
-- a request existing first.
--
-- SEPARATELY: adds ambient in-app notifications (I7.20) for the
-- transitions a user actually needs a signal for — reusing the existing
-- `notifications` table/type-string convention from 0068_notifications.sql
-- exactly as its own header comment anticipated ("future notification
-- producers ... can reuse this same table without a schema rewrite per
-- event type"). No second notification system. Four new `type` values:
-- 'execution_authorization_rejected', 'execution_succeeded',
-- 'execution_failed', 'execution_cancelled' — each SECURITY DEFINER RPC
-- inserts directly for the CURRENT actor (always the request's own
-- owner in this v1 single-approver flow), so no RLS change is needed on
-- `notifications` itself (existing "Users view their own notifications"
-- policy already covers it).

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
  if not public.has_feature((select auth.uid()), 'action_intelligence') then
    raise exception 'create_execution_request: action/execution intelligence requires an upgraded plan';
  end if;

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
-- authorize_execution_request() — unchanged logic, plus a notification
-- on rejection only (approval is self-directed in this v1 single-
-- approver flow — the same user who proposed the request just approved
-- it themselves, so notifying them "approved" tells them nothing they
-- don't already know; a rejection is worth a durable, revisitable
-- signal the same way an execution failure is).
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

  if p_decision = 'rejected' then
    insert into public.notifications (recipient_user_id, type, payload)
    values (v_request.user_id, 'execution_authorization_rejected', jsonb_build_object('execution_request_id', v_request.id, 'capability', v_request.capability));
  end if;

  return v_authorization;
end;
$$;

revoke all on function public.authorize_execution_request(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.authorize_execution_request(uuid, text, jsonb, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- record_execution_attempt() — unchanged logic, plus a notification on
-- the two TERMINAL outcomes (succeeded, final failure) — an
-- intermediate non-final failure (status stays 'executing' for a
-- bounded retry) is deliberately silent, since the request isn't
-- actually done yet and a notification per attempt would just be noise.
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
    insert into public.notifications (recipient_user_id, type, payload)
    values (v_request.user_id, 'execution_succeeded', jsonb_build_object('execution_request_id', v_request.id, 'capability', v_request.capability));
  elsif p_is_final then
    update public.execution_requests set status = 'failed' where id = v_request.id;
    insert into public.execution_audit_events (execution_request_id, event_type, actor_user_id, metadata) values (v_request.id, 'execution_failed', (select auth.uid()), jsonb_build_object('failure_kind', p_failure_kind));
    insert into public.notifications (recipient_user_id, type, payload)
    values (v_request.user_id, 'execution_failed', jsonb_build_object('execution_request_id', v_request.id, 'capability', v_request.capability, 'failure_kind', p_failure_kind));
  end if;

  return v_attempt;
end;
$$;

revoke all on function public.record_execution_attempt(uuid, text, text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.record_execution_attempt(uuid, text, text, text, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- cancel_execution() — unchanged logic, plus a notification (a
-- cancellation initiated by the same user IS still worth a durable
-- record in their notification history, unlike self-approval, since it
-- may happen well after the fact or from a different surface than the
-- one showing the request live).
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

  insert into public.notifications (recipient_user_id, type, payload)
  values (v_request.user_id, 'execution_cancelled', jsonb_build_object('execution_request_id', v_request.id, 'capability', v_request.capability, 'reason', p_reason));

  return v_request;
end;
$$;

revoke all on function public.cancel_execution(uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_execution(uuid, text) to authenticated;
