import { supabase } from '@/shared/lib/supabase'
import { computeContractHash } from '@/modules/execution-foundation/api/contractHash'
import { toExecutionRequest } from '@/modules/execution-foundation/api/mappers'
import type { ExecutionContract, ExecutionRequest, ExecutionSource } from '@/modules/execution-foundation/execution'

const DEFAULT_TTL_SECONDS = 24 * 60 * 60

/**
 * ACTION -> EXECUTION REQUEST. The idempotency key is deliberately the
 * contract hash itself, not a separate client-generated value — an
 * identical contract (same user, same action, same capability, same
 * target) always hashes identically, so proposing "the same thing" twice
 * (a double click, a retried network request) naturally collides on
 * create_execution_request()'s own unique(user_id, idempotency_key)
 * constraint and returns the EXISTING row rather than creating a
 * duplicate — see sprint brief Phase 6.
 *
 * I7 fix — create_execution_request() itself now enforces
 * has_feature(user, 'action_intelligence') server-side (0085_execution_
 * foundation_entitlement_and_notifications.sql); previously nothing
 * stopped a non-entitled user from reaching this RPC directly and fully
 * executing an internal capability, bypassing Action Intelligence's own
 * entitlement gate (which only ever covered action *generation*). ActionsPage.tsx
 * already only renders the "Request execution" affordance behind
 * useHasActionIntelligence(), so no client-side change was needed here —
 * this doc note exists so the real, authoritative gate isn't missed.
 */
export async function createExecutionRequest(params: {
  workspaceId: string | null
  contract: ExecutionContract
  source: ExecutionSource
  actionSnapshot: Record<string, unknown> | null
  ttlSeconds?: number
}): Promise<ExecutionRequest> {
  const { workspaceId, contract, source, actionSnapshot, ttlSeconds = DEFAULT_TTL_SECONDS } = params
  const contractHash = await computeContractHash(contract)

  const { data, error } = await supabase.rpc('create_execution_request', {
    p_workspace_id: workspaceId,
    p_capability: contract.capability,
    p_action_snapshot: actionSnapshot,
    p_source: source as unknown as Record<string, unknown>,
    p_target: contract.target,
    p_input_payload: contract.inputPayload,
    p_expected_effect: contract.expectedEffect,
    p_risk_classification: contract.riskClassification,
    p_external_side_effects: contract.externalSideEffects,
    p_idempotency_key: contractHash,
    p_contract_hash: contractHash,
    p_ttl_seconds: ttlSeconds,
  })
  if (error) throw error
  return toExecutionRequest(data)
}
