import { describe, expect, it } from 'vitest'
import { NOVA_AVOIDANCES, NOVA_TRAITS, buildPersonalityPrompt } from '@/modules/intelligence/personality/novaPersonality'

describe('buildPersonalityPrompt', () => {
  it('names ARRIYIA and states its role', () => {
    expect(buildPersonalityPrompt()).toContain('You are ARRIYIA')
  })

  it('includes every defined trait', () => {
    const prompt = buildPersonalityPrompt()
    for (const trait of NOVA_TRAITS) expect(prompt).toContain(trait.name)
  })

  it('includes every avoidance rule', () => {
    const prompt = buildPersonalityPrompt()
    for (const avoidance of NOVA_AVOIDANCES) expect(prompt).toContain(avoidance)
  })

  it('is stable across calls (pure, no randomness/state)', () => {
    expect(buildPersonalityPrompt()).toBe(buildPersonalityPrompt())
  })
})
