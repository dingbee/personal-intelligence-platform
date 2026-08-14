import type { ExecutionContract } from '@/modules/execution-foundation/execution'

/** Recursively sorts object keys so two logically-identical contracts (built independently, in any field order) always serialize to the same string — the whole point of a hash meant to detect a MATERIAL change, not an incidental one. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** The exact material fields a contract hash is computed over — capability/target/input/expected-effect/risk/side-effects, i.e. everything in ExecutionContract. Exported so tests can assert the hash actually changes when (and only when) one of these fields changes. */
export function serializeContract(contract: ExecutionContract): string {
  return stableStringify({
    capability: contract.capability,
    target: contract.target,
    inputPayload: contract.inputPayload,
    expectedEffect: contract.expectedEffect,
    riskClassification: contract.riskClassification,
    externalSideEffects: contract.externalSideEffects,
  })
}

/**
 * A stable SHA-256 hash of an execution contract's own material fields —
 * computed once at request-creation time (see createExecutionRequest.ts)
 * and never recomputed from a later mutation, since the contract itself
 * is immutable after creation. start_execution() in the migration
 * compares this against the hash an authorization actually approved, so
 * an authorization can never be silently carried over to a materially
 * different contract (sprint brief Phase 5's own explicit requirement).
 */
export async function computeContractHash(contract: ExecutionContract): Promise<string> {
  const bytes = new TextEncoder().encode(serializeContract(contract))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
