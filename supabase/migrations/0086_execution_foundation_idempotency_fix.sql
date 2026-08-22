-- ARRIYIA — I7 Action/Execution Intelligence: fix a genuine, serious
-- idempotency defect in create_execution_request(), present since
-- 0065_execution_foundation.sql and never actually exercised until this
-- sprint's adversarial idempotency testing.
--
-- GENUINE DEFECT FOUND (I7.8 — REQUIRED): the idempotency check
--   if v_existing is not null then return v_existing; end if;
-- uses `IS NOT NULL` on a composite/row-typed PL/pgSQL variable
-- (`v_existing public.execution_requests`). Per SQL's own row-value
-- comparison semantics, `ROW IS NOT NULL` is only true when EVERY field
-- of the row is non-null, and `ROW IS NULL` is only true when EVERY
-- field is null — a row with a MIX of null and non-null fields (e.g. a
-- genuinely found execution_requests row whose nullable `workspace_id`
-- happens to be null, which is the common/default case for a request
-- not scoped to a workspace) satisfies NEITHER condition. The result:
-- `v_existing is not null` silently evaluates to FALSE even though the
-- row genuinely exists and was found — verified live, conclusively,
-- with a diagnostic function before writing this fix (FOUND=true,
-- `v_existing is not null`=false, for the exact real row just inserted).
--
-- IMPACT: calling create_execution_request() twice with the same
-- idempotency key, for any request with workspace_id IS NULL (which is
-- every request the current UI ever creates — ActionsPage.tsx never
-- passes a workspace_id today, see buildExecutionContract.ts), does NOT
-- return the existing row as designed. It falls through to the INSERT,
-- which then raises a raw unique-constraint violation
-- (execution_requests_user_idempotency_key) instead of the intended
-- idempotent no-op. A network retry or a double-click on "Request
-- execution" would surface a hard error to the user instead of quietly
-- reusing the already-proposed request — the opposite of I7.8's own
-- "REQUIRED" guarantee.
--
-- FIX: replace the composite-row null check with PL/pgSQL's own `FOUND`
-- special variable, which is set by the immediately preceding `SELECT
-- INTO` to true iff at least one row was returned — the correct,
-- idiomatic check for "did my select find something," unaffected by
-- which individual fields happen to be null. CREATE OR REPLACE,
-- otherwise byte-identical to the function as fixed by 0085 (entitlement
-- check preserved).

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

  if FOUND then
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
