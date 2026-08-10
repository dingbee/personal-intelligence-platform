import { describe, expect, it } from 'vitest'
import type { AIProviderDescriptor } from '@/modules/core/providers/types'
import type { ProviderAvailability } from '@/modules/ai/providers/availability'
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

  describe('requireVision', () => {
    const mixedVisionProviders: AIProviderDescriptor[] = [
      { id: 'anthropic', label: 'Anthropic', kind: 'chat', status: 'available', supportsVision: true },
      { id: 'openai', label: 'OpenAI', kind: 'chat', status: 'available', supportsVision: true },
      { id: 'text-only', label: 'Text Only', kind: 'chat', status: 'available', supportsVision: false },
    ]
    const allAvailableMixed: ProviderAvailability & Record<string, boolean> = {
      anthropic: true,
      openai: true,
      google: true,
      'text-only': true,
    }

    it('excludes a provider explicitly marked supportsVision: false when requireVision is set', () => {
      const chain = resolveProviderChain({
        preferredProviderId: 'openai',
        chatProviders: mixedVisionProviders,
        availability: allAvailableMixed,
        requireVision: true,
      })
      expect(chain).not.toContain('text-only')
      expect(chain).toEqual(['openai', 'anthropic'])
    })

    it('excludes even a preferred provider when it is not vision-capable', () => {
      const chain = resolveProviderChain({
        preferredProviderId: 'text-only',
        chatProviders: mixedVisionProviders,
        availability: allAvailableMixed,
        requireVision: true,
      })
      expect(chain).not.toContain('text-only')
    })

    it('treats a descriptor with supportsVision omitted as vision-capable', () => {
      const chain = resolveProviderChain({
        preferredProviderId: 'openai',
        chatProviders, // no supportsVision field on any entry here
        availability: allAvailable,
        requireVision: true,
      })
      expect(chain).toEqual(['openai', 'anthropic', 'google'])
    })

    it('does not affect the chain at all when requireVision is omitted, even with a text-only provider registered', () => {
      const chain = resolveProviderChain({
        preferredProviderId: 'openai',
        chatProviders: mixedVisionProviders,
        availability: allAvailableMixed,
      })
      expect(chain).toContain('text-only')
    })

    it('returns an empty chain when no vision-capable provider is eligible', () => {
      const textOnlyProviders: AIProviderDescriptor[] = [
        { id: 'text-only', label: 'Text Only', kind: 'chat', status: 'available', supportsVision: false },
      ]
      const availability: ProviderAvailability & Record<string, boolean> = {
        anthropic: false,
        openai: false,
        google: false,
        'text-only': true,
      }
      const chain = resolveProviderChain({
        preferredProviderId: 'text-only',
        chatProviders: textOnlyProviders,
        availability,
        requireVision: true,
      })
      expect(chain).toEqual([])
    })
  })

  describe('planAllowedProviderIds (Phase 5A commercial control)', () => {
    it('mirrors a Free plan: exactly one allowed provider survives filtering even when every provider is otherwise eligible', () => {
      const chain = resolveProviderChain({
        preferredProviderId: null,
        chatProviders,
        availability: allAvailable,
        planAllowedProviderIds: ['anthropic'],
      })
      expect(chain).toEqual(['anthropic'])
    })

    it('mirrors a Pro/Founding Pro plan: multiple allowed providers all survive filtering', () => {
      const chain = resolveProviderChain({
        preferredProviderId: null,
        chatProviders,
        availability: allAvailable,
        planAllowedProviderIds: ['anthropic', 'openai', 'google'],
      })
      expect(chain).toHaveLength(3)
    })

    it('excludes even the preferred provider when the plan does not allow it', () => {
      const chain = resolveProviderChain({
        preferredProviderId: 'openai',
        chatProviders,
        availability: allAvailable,
        planAllowedProviderIds: ['anthropic'],
      })
      expect(chain).toEqual(['anthropic'])
    })

    it('an empty allowed-provider list blocks everything — this is how useProviderChain fails closed while the plan/allocation query is still loading', () => {
      const chain = resolveProviderChain({
        preferredProviderId: 'openai',
        chatProviders,
        availability: allAvailable,
        planAllowedProviderIds: [],
      })
      expect(chain).toEqual([])
    })

    it('omitting planAllowedProviderIds entirely (undefined) preserves every existing caller\'s unrestricted behavior', () => {
      const chain = resolveProviderChain({ preferredProviderId: 'openai', chatProviders, availability: allAvailable })
      expect(chain).toHaveLength(3)
    })

    it('planProviderPriority orders the remainder ahead of platformSettings priority and health score', () => {
      const chain = resolveProviderChain({
        preferredProviderId: null,
        chatProviders,
        availability: allAvailable,
        planAllowedProviderIds: ['anthropic', 'openai', 'google'],
        planProviderPriority: { anthropic: 2, openai: 1, google: 0 },
        healthScores: { anthropic: 10, openai: 20, google: 99 },
        platformSettings: { google: { enabled: true, priority: 50 } },
      })
      expect(chain).toEqual(['anthropic', 'openai', 'google'])
    })
  })
})
