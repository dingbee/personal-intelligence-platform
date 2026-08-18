import { describe, expect, it, vi } from 'vitest'
import { handleAiChatFlow, type AiChatFlowDeps, type AiChatFlowRequest } from '@/modules/ai/orchestration/aiChatRequestFlow'
import { INTELLIGENCE_OPERATION_QUOTA_KEYS, type IntelligenceOperationType } from '@/shared/lib/intelligenceOperations'

/**
 * P0-1 hardening pass — production-oriented tests against the mirrored
 * `Deno.serve` control flow (aiChatRequestFlow.ts), not just the leaf
 * predicates aiChatAuthorization.test.ts already covers. These assert on
 * branch order and call counts: that a denied request never reaches the
 * provider, that quota is consumed exactly once per allowed request, and
 * that an audit row is written for a real provider attempt (success or
 * failure) but never for an earlier authorization/quota rejection —
 * matching supabase/functions/ai-chat/index.ts exactly.
 */

const BASE_REQUEST: AiChatFlowRequest = {
  authHeader: 'Bearer valid-jwt',
  action: 'chat',
  provider: 'anthropic',
}

function makeDeps(overrides: Partial<AiChatFlowDeps> = {}): AiChatFlowDeps {
  return {
    getUser: vi.fn(async () => ({ id: 'user-1' })),
    getActivePlanId: vi.fn(async () => 'plan-1'),
    isProviderAllowedForPlan: vi.fn(async () => true),
    hasFeature: vi.fn(async () => true),
    consumeQuota: vi.fn(async () => true),
    callProvider: vi.fn(async () => ({ ok: true }) as const),
    recordAudit: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('handleAiChatFlow', () => {
  it('missing JWT (no Authorization header) -> 401, and no dependency is ever called', async () => {
    const deps = makeDeps()
    const result = await handleAiChatFlow({ ...BASE_REQUEST, authHeader: null }, deps)

    expect(result.status).toBe(401)
    expect(deps.getUser).not.toHaveBeenCalled()
    expect(deps.callProvider).not.toHaveBeenCalled()
  })

  it('invalid JWT (getUser resolves null) -> 401, and nothing past auth is called', async () => {
    const deps = makeDeps({ getUser: vi.fn(async () => null) })
    const result = await handleAiChatFlow(BASE_REQUEST, deps)

    expect(result.status).toBe(401)
    expect(deps.getActivePlanId).not.toHaveBeenCalled()
    expect(deps.callProvider).not.toHaveBeenCalled()
  })

  it('authenticated user with no active plan -> 403, before any provider/quota check', async () => {
    const deps = makeDeps({ getActivePlanId: vi.fn(async () => null) })
    const result = await handleAiChatFlow(BASE_REQUEST, deps)

    expect(result.status).toBe(403)
    expect(deps.isProviderAllowedForPlan).not.toHaveBeenCalled()
    expect(deps.consumeQuota).not.toHaveBeenCalled()
    expect(deps.callProvider).not.toHaveBeenCalled()
  })

  it('unauthorized provider (not in plan_ai_providers) -> 403, and quota is never touched', async () => {
    const deps = makeDeps({ isProviderAllowedForPlan: vi.fn(async () => false) })
    const result = await handleAiChatFlow(BASE_REQUEST, deps)

    expect(result.status).toBe(403)
    expect(deps.consumeQuota).not.toHaveBeenCalled()
    expect(deps.callProvider).not.toHaveBeenCalled()
  })

  it('unauthorized model (does not match the plan/provider default) -> 403, and quota is never touched', async () => {
    const deps = makeDeps()
    const result = await handleAiChatFlow({ ...BASE_REQUEST, model: 'claude-legacy-1' }, deps)

    expect(result.status).toBe(403)
    expect(deps.consumeQuota).not.toHaveBeenCalled()
    expect(deps.callProvider).not.toHaveBeenCalled()
  })

  it('exhausted quota (consumeQuota resolves not-allowed) -> 429, and the provider is never called', async () => {
    const deps = makeDeps({ consumeQuota: vi.fn(async () => false) })
    const result = await handleAiChatFlow(BASE_REQUEST, deps)

    expect(result.status).toBe(429)
    expect(deps.callProvider).not.toHaveBeenCalled()
  })

  it('denied quota -> provider never called (repeated with an operation-scoped quota key)', async () => {
    const deps = makeDeps({ consumeQuota: vi.fn(async () => false) })
    const result = await handleAiChatFlow({ ...BASE_REQUEST, quotaKey: 'data_intelligence_operations' }, deps)

    expect(result.status).toBe(429)
    expect(deps.callProvider).not.toHaveBeenCalled()
  })

  it('allowed request -> the provider is called exactly once', async () => {
    const deps = makeDeps()
    const result = await handleAiChatFlow(BASE_REQUEST, deps)

    expect(result.status).toBe(200)
    expect(deps.callProvider).toHaveBeenCalledTimes(1)
    expect(deps.consumeQuota).toHaveBeenCalledTimes(1)
  })

  it('audit row is written on a successful provider call', async () => {
    const deps = makeDeps()
    await handleAiChatFlow(BASE_REQUEST, deps)

    expect(deps.recordAudit).toHaveBeenCalledTimes(1)
    expect(deps.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', errorMessage: null }))
  })

  it('audit row is written on a failing provider call, with the real error surfaced as a 502', async () => {
    const deps = makeDeps({ callProvider: vi.fn(async () => ({ ok: false, message: 'Anthropic error: 529 overloaded' })) })
    const result = await handleAiChatFlow(BASE_REQUEST, deps)

    expect(result.status).toBe(502)
    expect(deps.recordAudit).toHaveBeenCalledTimes(1)
    expect(deps.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', errorMessage: 'Anthropic error: 529 overloaded' }))
  })

  it('no audit row is written for an authorization or quota rejection (401/403/429) — only a real provider attempt is audited', async () => {
    const deniedDeps = makeDeps({ consumeQuota: vi.fn(async () => false) })
    await handleAiChatFlow(BASE_REQUEST, deniedDeps)
    expect(deniedDeps.recordAudit).not.toHaveBeenCalled()

    const noPlanDeps = makeDeps({ getActivePlanId: vi.fn(async () => null) })
    await handleAiChatFlow(BASE_REQUEST, noPlanDeps)
    expect(noPlanDeps.recordAudit).not.toHaveBeenCalled()
  })

  it('resolves the correct quota key (and its stripped feature key) for every Intelligence operation', async () => {
    const operationTypes = Object.keys(INTELLIGENCE_OPERATION_QUOTA_KEYS) as IntelligenceOperationType[]

    for (const operationType of operationTypes) {
      const expectedQuotaKey = INTELLIGENCE_OPERATION_QUOTA_KEYS[operationType]
      const deps = makeDeps()
      const result = await handleAiChatFlow({ ...BASE_REQUEST, quotaKey: expectedQuotaKey }, deps)

      expect(result.status).toBe(200)
      expect(deps.hasFeature).toHaveBeenCalledWith('user-1', operationType)
      expect(deps.consumeQuota).toHaveBeenCalledWith(expectedQuotaKey)
    }
  })

  it('an operation-scoped quota key the caller is not entitled to (has_feature false) is rejected with 403, never billed', async () => {
    const deps = makeDeps({ hasFeature: vi.fn(async () => false) })
    const result = await handleAiChatFlow({ ...BASE_REQUEST, quotaKey: 'analysis_intelligence_operations' }, deps)

    expect(result.status).toBe(403)
    expect(deps.consumeQuota).not.toHaveBeenCalled()
    expect(deps.callProvider).not.toHaveBeenCalled()
  })

  it('concurrent quota requests cannot overspend: N concurrent calls against a shared atomic quota store never allow more than the limit through, and only the allowed ones reach the provider', async () => {
    const LIMIT = 3
    const CONCURRENT_REQUESTS = 10
    let consumed = 0

    // Mirrors consume_quota()'s real shape: a single atomic
    // check-and-increment. Deliberately synchronous with no `await` between
    // the read and the write, exactly like the real RPC's single
    // INSERT...ON CONFLICT...DO UPDATE...RETURNING — proving the flow
    // itself never does a separate client-side read-then-write that a real
    // async gap could race.
    const consumeQuota = vi.fn(async (_quotaKey: string) => {
      if (consumed >= LIMIT) return false
      consumed += 1
      return true
    })
    const callProvider = vi.fn(async () => ({ ok: true }) as const)
    const deps = makeDeps({ consumeQuota, callProvider })

    const results = await Promise.all(Array.from({ length: CONCURRENT_REQUESTS }, () => handleAiChatFlow(BASE_REQUEST, deps)))

    const allowedCount = results.filter((r) => r.status === 200).length
    const deniedCount = results.filter((r) => r.status === 429).length

    expect(allowedCount).toBe(LIMIT)
    expect(deniedCount).toBe(CONCURRENT_REQUESTS - LIMIT)
    expect(callProvider).toHaveBeenCalledTimes(LIMIT)
    expect(consumed).toBe(LIMIT)
  })
})
