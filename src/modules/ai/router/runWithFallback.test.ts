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
})
