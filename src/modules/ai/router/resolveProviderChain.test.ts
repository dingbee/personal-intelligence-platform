import { describe, expect, it } from 'vitest'
import type { AIProviderDescriptor } from '@/modules/core/providers/types'
import { resolveProviderChain } from '@/modules/ai/router/resolveProviderChain'

const chatProviders: AIProviderDescriptor[] = [
  { id: 'anthropic', label: 'Anthropic', kind: 'chat', status: 'available' },
  { id: 'openai', label: 'OpenAI', kind: 'chat', status: 'available' },
  { id: 'google', label: 'Google', kind: 'chat', status: 'available' },
  { id: 'ollama', label: 'Ollama', kind: 'chat', status: 'planned' },
]

const allAvailable = { anthropic: true, openai: true, google: true }

describe('resolveProviderChain', () => {
  it('puts the preferred provider first when it is eligible', () => {
    const chain = resolveProviderChain({ preferredProviderId: 'openai', chatProviders, availability: allAvailable })
    expect(chain[0]).toBe('openai')
    expect(chain).toHaveLength(3)
  })

  it('excludes planned (not wired up) providers entirely', () => {
    const chain = resolveProviderChain({ preferredProviderId: 'openai', chatProviders, availability: allAvailable })
    expect(chain).not.toContain('ollama')
  })

  it('excludes providers with no key configured', () => {
    const chain = resolveProviderChain({
      preferredProviderId: 'openai',
      chatProviders,
      availability: { anthropic: false, openai: true, google: true },
    })
    expect(chain).not.toContain('anthropic')
  })

  it('excludes providers disabled via overrides', () => {
    const chain = resolveProviderChain({
      preferredProviderId: 'openai',
      chatProviders,
      availability: allAvailable,
      overrides: { google: false },
    })
    expect(chain).not.toContain('google')
  })

  it('falls through to the eligible remainder, health-ordered, when the preferred provider is not eligible', () => {
    const chain = resolveProviderChain({
      preferredProviderId: 'openai',
      chatProviders,
      availability: { anthropic: true, openai: false, google: true },
      healthScores: { anthropic: 40, google: 90 },
    })
    expect(chain).toEqual(['google', 'anthropic'])
  })

  it('does not let health score reorder the preferred provider out of first place', () => {
    const chain = resolveProviderChain({
      preferredProviderId: 'anthropic',
      chatProviders,
      availability: allAvailable,
      healthScores: { anthropic: 10, openai: 99, google: 95 },
    })
    expect(chain[0]).toBe('anthropic')
  })

  it('returns an empty chain when nothing is eligible', () => {
    const chain = resolveProviderChain({
      preferredProviderId: 'openai',
      chatProviders,
      availability: { anthropic: false, openai: false, google: false },
    })
    expect(chain).toEqual([])
  })

  it('treats undefined availability as "not yet loaded" rather than gating everything out', () => {
    const chain = resolveProviderChain({ preferredProviderId: 'openai', chatProviders, availability: undefined })
    expect(chain[0]).toBe('openai')
    expect(chain).toHaveLength(3)
  })

  it('without health scores, leaves the remainder in registry order', () => {
    const chain = resolveProviderChain({ preferredProviderId: 'google', chatProviders, availability: allAvailable })
    expect(chain).toEqual(['google', 'anthropic', 'openai'])
  })

  it('platformSettings enabled:false removes a provider entirely, even when it is the preferred one', () => {
    const chain = resolveProviderChain({
      preferredProviderId: 'openai',
      chatProviders,
      availability: allAvailable,
      platformSettings: { openai: { enabled: false, priority: 0 } },
    })
    expect(chain).not.toContain('openai')
    expect(chain).toEqual(['anthropic', 'google'])
  })

  it('platformSettings priority orders the remainder ahead of health score', () => {
    const chain = resolveProviderChain({
      preferredProviderId: 'openai',
      chatProviders,
      availability: allAvailable,
      healthScores: { anthropic: 99, google: 10 },
      platformSettings: { anthropic: { enabled: true, priority: 0 }, google: { enabled: true, priority: 10 } },
    })
    expect(chain).toEqual(['openai', 'google', 'anthropic'])
  })

  it('omitting platformSettings entirely leaves existing health-score-only ordering unchanged', () => {
    const chain = resolveProviderChain({
      preferredProviderId: 'openai',
      chatProviders,
      availability: { anthropic: true, openai: false, google: true },
      healthScores: { anthropic: 40, google: 90 },
    })
    expect(chain).toEqual(['google', 'anthropic'])
  })
})
