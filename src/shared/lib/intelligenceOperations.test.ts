import { beforeEach, describe, expect, it, vi } from 'vitest'

const { checkQuotaMock, consumeQuotaMock } = vi.hoisted(() => ({
  checkQuotaMock: vi.fn(),
  consumeQuotaMock: vi.fn(),
}))

// Operation Budget Foundation — beginIntelligenceOperation/runOperationAiCall
// talk to quotaService, which talks to Supabase directly; mock it the same
// way AIService.test.ts does so this suite never hits the real project.
vi.mock('@/shared/lib/quotaService', () => ({
  quotaService: {
    checkQuota: checkQuotaMock,
    consumeQuota: consumeQuotaMock,
  },
}))

import {
  beginIntelligenceOperation,
  isOperationBudgetExhausted,
  runOperationAiCall,
  OperationBudgetExhaustedError,
  IntelligenceOperationQuotaDeniedError,
  type IntelligenceOperation,
} from '@/shared/lib/intelligenceOperations'

describe('intelligenceOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    checkQuotaMock.mockResolvedValue({ allowed: true, used: 0, limit: 1000 })
    consumeQuotaMock.mockResolvedValue(true)
  })

  describe('beginIntelligenceOperation', () => {
    it('denies starting the operation and never returns one when the monthly quota is already exhausted', async () => {
      checkQuotaMock.mockResolvedValueOnce({ allowed: false, reason: 'Monthly limit reached.' })

      await expect(beginIntelligenceOperation({ operationType: 'data_intelligence', userId: 'user-1', workspaceId: null })).rejects.toThrow(
        IntelligenceOperationQuotaDeniedError,
      )
    })

    it('carries the operationType and reason on the quota-denied error', async () => {
      checkQuotaMock.mockResolvedValueOnce({ allowed: false, reason: 'Monthly limit reached.' })

      try {
        await beginIntelligenceOperation({ operationType: 'research_intelligence', userId: 'user-1', workspaceId: null })
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(IntelligenceOperationQuotaDeniedError)
        expect((err as IntelligenceOperationQuotaDeniedError).operationType).toBe('research_intelligence')
        expect((err as Error).message).toBe('Monthly limit reached.')
      }
    })

    it('falls back to a generic reason when checkQuota denies without one', async () => {
      checkQuotaMock.mockResolvedValueOnce({ allowed: false })

      await expect(beginIntelligenceOperation({ operationType: 'analysis_intelligence', userId: 'user-1', workspaceId: null })).rejects.toThrow(
        /analysis_intelligence operation quota limit reached/,
      )
    })

    it('checks the correct per-engine quota key for each operation type', async () => {
      await beginIntelligenceOperation({ operationType: 'data_intelligence', userId: 'user-1', workspaceId: null })
      expect(checkQuotaMock).toHaveBeenCalledWith('user-1', 'data_intelligence_operations')

      await beginIntelligenceOperation({ operationType: 'analysis_intelligence', userId: 'user-1', workspaceId: null })
      expect(checkQuotaMock).toHaveBeenCalledWith('user-1', 'analysis_intelligence_operations')

      await beginIntelligenceOperation({ operationType: 'research_intelligence', userId: 'user-1', workspaceId: null })
      expect(checkQuotaMock).toHaveBeenCalledWith('user-1', 'research_intelligence_operations')
    })

    it('opens a fresh, ready operation with zero calls consumed and a real operationId when the quota allows it', async () => {
      const operation = await beginIntelligenceOperation({ operationType: 'data_intelligence', userId: 'user-1', workspaceId: 'workspace-1' })

      expect(operation.status).toBe('ready')
      expect(operation.callsConsumed).toBe(0)
      expect(operation.userId).toBe('user-1')
      expect(operation.workspaceId).toBe('workspace-1')
      expect(operation.operationType).toBe('data_intelligence')
      expect(typeof operation.operationId).toBe('string')
      expect(operation.operationId.length).toBeGreaterThan(0)
    })

    it('gives each operation a distinct operationId', async () => {
      const a = await beginIntelligenceOperation({ operationType: 'data_intelligence', userId: 'user-1', workspaceId: null })
      const b = await beginIntelligenceOperation({ operationType: 'data_intelligence', userId: 'user-1', workspaceId: null })
      expect(a.operationId).not.toBe(b.operationId)
    })

    it('resolves the documented hard ceiling for each engine when no requestedBudget is supplied', async () => {
      const data = await beginIntelligenceOperation({ operationType: 'data_intelligence', userId: 'user-1', workspaceId: null })
      const analysis = await beginIntelligenceOperation({ operationType: 'analysis_intelligence', userId: 'user-1', workspaceId: null })
      const research = await beginIntelligenceOperation({ operationType: 'research_intelligence', userId: 'user-1', workspaceId: null })

      expect(data.maxCalls).toBe(6)
      expect(analysis.maxCalls).toBe(18)
      expect(research.maxCalls).toBe(45)
    })

    it('lets a requestedBudget narrow the effective ceiling below the hard maximum', async () => {
      const operation = await beginIntelligenceOperation({ operationType: 'analysis_intelligence', userId: 'user-1', workspaceId: null, requestedBudget: 3 })
      expect(operation.maxCalls).toBe(3)
    })

    it('never lets a requestedBudget widen the effective ceiling past the hard maximum — a client cannot buy a bigger budget than the server allows', async () => {
      const operation = await beginIntelligenceOperation({ operationType: 'data_intelligence', userId: 'user-1', workspaceId: null, requestedBudget: 999 })
      expect(operation.maxCalls).toBe(6)
    })

    it('treats a requestedBudget of 0 as no real budget at all (clamped, not ignored)', async () => {
      const operation = await beginIntelligenceOperation({ operationType: 'data_intelligence', userId: 'user-1', workspaceId: null, requestedBudget: 0 })
      // 0 is falsy, so the `requestedBudget ? ... : hardCeiling` branch intentionally
      // falls back to the hard ceiling rather than opening a zero-budget operation —
      // documenting this exact behavior so a future refactor can't silently invert it.
      expect(operation.maxCalls).toBe(6)
    })
  })

  describe('isOperationBudgetExhausted', () => {
    function op(overrides: Partial<IntelligenceOperation> = {}): IntelligenceOperation {
      return { operationId: 'op-1', operationType: 'data_intelligence', userId: 'user-1', workspaceId: null, maxCalls: 3, callsConsumed: 0, status: 'ready', ...overrides }
    }

    it('is false while calls consumed is below the max', () => {
      expect(isOperationBudgetExhausted(op({ maxCalls: 3, callsConsumed: 2 }))).toBe(false)
    })

    it('is true once calls consumed reaches the max', () => {
      expect(isOperationBudgetExhausted(op({ maxCalls: 3, callsConsumed: 3 }))).toBe(true)
    })

    it('is true if calls consumed somehow exceeds the max (fail safe, not fail open)', () => {
      expect(isOperationBudgetExhausted(op({ maxCalls: 3, callsConsumed: 4 }))).toBe(true)
    })
  })

  describe('runOperationAiCall', () => {
    function op(overrides: Partial<IntelligenceOperation> = {}): IntelligenceOperation {
      return { operationId: 'op-1', operationType: 'data_intelligence', userId: 'user-1', workspaceId: null, maxCalls: 3, callsConsumed: 0, status: 'ready', ...overrides }
    }

    it('refuses to start and never calls run when the operation is already exhausted', async () => {
      const operation = op({ maxCalls: 1, callsConsumed: 1 })
      const run = vi.fn(async () => 'unreachable')

      await expect(runOperationAiCall(operation, ['anthropic'], run)).rejects.toThrow(OperationBudgetExhaustedError)
      expect(run).not.toHaveBeenCalled()
      expect(operation.status).toBe('budget_exhausted')
    })

    it('records exactly one consumed call and one consumeQuota invocation for a single successful attempt', async () => {
      const operation = op()
      const run = vi.fn(async () => 'answer')

      const { result } = await runOperationAiCall(operation, ['anthropic'], run)

      expect(result).toBe('answer')
      expect(operation.callsConsumed).toBe(1)
      expect(consumeQuotaMock).toHaveBeenCalledTimes(1)
      expect(consumeQuotaMock).toHaveBeenCalledWith('user-1', 'data_intelligence_operations')
      expect(operation.status).toBe('running')
    })

    it('still records a consumed call for a failed attempt — a failure is not free', async () => {
      const operation = op({ maxCalls: 3 })
      const run = vi.fn(async (providerId: string) => {
        if (providerId === 'anthropic') throw new Error('anthropic down')
        return 'ok'
      })

      await runOperationAiCall(operation, ['anthropic', 'openai'], run)

      // Two real attempts (anthropic failed, openai succeeded) — both consumed budget.
      expect(operation.callsConsumed).toBe(2)
      expect(consumeQuotaMock).toHaveBeenCalledTimes(2)
    })

    it('counts every individual provider-fallback attempt against the budget, not one call per operation', async () => {
      const operation = op({ maxCalls: 5 })
      const run = vi.fn(async () => {
        throw new Error('down')
      })

      await expect(runOperationAiCall(operation, ['anthropic', 'openai', 'google'], run)).rejects.toThrow('down')
      expect(operation.callsConsumed).toBe(3)
      expect(consumeQuotaMock).toHaveBeenCalledTimes(3)
    })

    it('stops attempting further fallback candidates once the budget runs out mid-chain, and reclassifies the result as OperationBudgetExhaustedError', async () => {
      const operation = op({ maxCalls: 2 })
      const run = vi.fn(async () => {
        throw new Error('down')
      })

      await expect(runOperationAiCall(operation, ['anthropic', 'openai', 'google'], run)).rejects.toThrow(OperationBudgetExhaustedError)
      // Only 2 attempts happened even though 3 candidates were offered — the budget
      // ran out after the 2nd attempt and the 3rd was never tried.
      expect(run).toHaveBeenCalledTimes(2)
      expect(operation.callsConsumed).toBe(2)
      expect(operation.status).toBe('budget_exhausted')
    })

    it('propagates a genuine provider failure unchanged when every candidate failed but the budget was NOT the cause', async () => {
      const operation = op({ maxCalls: 10 })
      const run = vi.fn(async () => {
        throw new Error('all providers unavailable')
      })

      await expect(runOperationAiCall(operation, ['anthropic', 'openai'], run)).rejects.toThrow('all providers unavailable')
      expect(operation.status).not.toBe('budget_exhausted')
    })

    it('never calls consumeQuota for a candidate that was never actually attempted', async () => {
      const operation = op({ maxCalls: 1 })
      const run = vi.fn(async () => 'ok')

      await runOperationAiCall(operation, ['anthropic', 'openai', 'google'], run)

      // Succeeded on the first candidate — the other two were never attempted and
      // never consumed budget or quota.
      expect(run).toHaveBeenCalledTimes(1)
      expect(consumeQuotaMock).toHaveBeenCalledTimes(1)
      expect(operation.callsConsumed).toBe(1)
    })
  })

  describe('OperationBudgetExhaustedError', () => {
    it('carries the operationType and maxCalls, and names itself distinctly from a generic Error', () => {
      const err = new OperationBudgetExhaustedError('research_intelligence', 45)
      expect(err.name).toBe('OperationBudgetExhaustedError')
      expect(err.operationType).toBe('research_intelligence')
      expect(err.maxCalls).toBe(45)
      expect(err).toBeInstanceOf(Error)
    })
  })
})
