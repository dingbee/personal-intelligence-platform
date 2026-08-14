import { describe, expect, it, vi } from 'vitest'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'

describe('runWithFallback', () => {
  it('returns the first candidate\'s result without trying any others when it succeeds', async () => {
    const run = vi.fn(async (providerId: string) => `ok:${providerId}`)
    const { result, providerId } = await runWithFallback(['openai', 'anthropic'], run)
    expect(result).toBe('ok:openai')
    expect(providerId).toBe('openai')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('falls through to the next candidate when the first one throws', async () => {
    const run = vi.fn(async (providerId: string) => {
      if (providerId === 'openai') throw new Error('openai down')
      return `ok:${providerId}`
    })
    const { result, providerId } = await runWithFallback(['openai', 'anthropic'], run)
    expect(result).toBe('ok:anthropic')
    expect(providerId).toBe('anthropic')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('throws the last candidate\'s error when every candidate fails', async () => {
    const run = vi.fn(async (providerId: string) => {
      throw new Error(`${providerId} down`)
    })
    await expect(runWithFallback(['openai', 'anthropic'], run)).rejects.toThrow('anthropic down')
  })

  it('throws PROVIDER_UNAVAILABLE_MESSAGE immediately for an empty chain, without calling run', async () => {
    const run = vi.fn(async () => 'unreachable')
    await expect(runWithFallback([], run)).rejects.toThrow(/unavailable/i)
    expect(run).not.toHaveBeenCalled()
  })

  it('tries candidates strictly in order', async () => {
    const attempted: string[] = []
    const run = vi.fn(async (providerId: string) => {
      attempted.push(providerId)
      if (providerId !== 'google') throw new Error('down')
      return 'ok'
    })
    await runWithFallback(['openai', 'anthropic', 'google'], run)
    expect(attempted).toEqual(['openai', 'anthropic', 'google'])
  })

  // Operation Budget Foundation — shouldAbort lets a budget-aware caller
  // (intelligenceOperations.ts's runOperationAiCall) stop the fallback
  // chain early without this generic function knowing anything about
  // quotas or operations.
  describe('shouldAbort option', () => {
    it('never calls run at all when shouldAbort is already true before the first candidate', async () => {
      const run = vi.fn(async () => 'unreachable')
      await expect(runWithFallback(['openai', 'anthropic'], run, { shouldAbort: () => true })).rejects.toThrow()
      expect(run).not.toHaveBeenCalled()
    })

    it('stops trying further candidates once shouldAbort flips true mid-chain', async () => {
      let attempts = 0
      const run = vi.fn(async () => {
        attempts += 1
        throw new Error(`down ${attempts}`)
      })
      // Aborts after the first attempt has already failed.
      const shouldAbort = () => attempts >= 1
      await expect(runWithFallback(['openai', 'anthropic', 'google'], run, { shouldAbort })).rejects.toThrow('down 1')
      expect(run).toHaveBeenCalledTimes(1)
    })

    it('is backward compatible: a caller that never passes shouldAbort behaves exactly as before', async () => {
      const run = vi.fn(async (providerId: string) => `ok:${providerId}`)
      const { result } = await runWithFallback(['openai'], run)
      expect(result).toBe('ok:openai')
    })

    it('still returns a successful result even with shouldAbort present, as long as it never returns true before success', async () => {
      const run = vi.fn(async (providerId: string) => `ok:${providerId}`)
      const { result } = await runWithFallback(['openai'], run, { shouldAbort: () => false })
      expect(result).toBe('ok:openai')
    })
  })
})
