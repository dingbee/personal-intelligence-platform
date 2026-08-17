import { describe, expect, it } from 'vitest'
import { buildNovaContextPrompt } from '@/modules/intelligence/buildNovaContextPrompt'
import { describeResponseStrategy } from '@/modules/intelligence/strategy/responseStrategy'
import type { ResponseStrategyType } from '@/modules/intelligence/strategy/strategyTypes'
import type { NovaContext } from '@/modules/intelligence/context/types'

const EMPTY: NovaContext = {
  workspaceContext: null,
  activityContext: null,
  knowledgeContext: null,
  memoryContext: null,
  userContext: null,
  attentionContext: null,
  evolutionContext: null,
}

const ALL_STRATEGIES: ResponseStrategyType[] = [
  'brief',
  'standard',
  'exploratory',
  'tutorial',
  'decision',
  'comparison',
  'planning',
  'executive_summary',
]

describe('buildNovaContextPrompt', () => {
  it('always includes the personality block', () => {
    expect(buildNovaContextPrompt(EMPTY, 'standard')).toContain('You are ARRIYIA')
  })

  it("always includes the Reasoning Planner's response-style guidance for the given strategy", () => {
    expect(buildNovaContextPrompt(EMPTY, 'exploratory')).toContain(describeResponseStrategy('exploratory'))
  })

  it.each(ALL_STRATEGIES)('includes the correct developer-authored guidance for the "%s" strategy', (strategy) => {
    expect(buildNovaContextPrompt(EMPTY, strategy)).toContain(describeResponseStrategy(strategy))
  })

  it('never dumps raw planner metadata into the prompt — only the closed-set guidance string', () => {
    const prompt = buildNovaContextPrompt(EMPTY, 'decision')
    expect(prompt).not.toContain('suggestedCommandIds')
    expect(prompt).not.toContain('requiredContext')
    expect(prompt).not.toContain('reasoningPlan')
  })

  it('includes a "Current context" section when situational context is available', () => {
    const context: NovaContext = {
      ...EMPTY,
      activityContext: { inProgressDocument: null, recentConversations: [{ id: 'conv-1', title: 'Topic A' }] },
    }
    const prompt = buildNovaContextPrompt(context, 'standard')
    expect(prompt).toContain('Current context:')
    expect(prompt).toContain('Topic A')
  })

  it('omits the "Current context" section when nothing is available', () => {
    expect(buildNovaContextPrompt(EMPTY, 'standard')).not.toContain('Current context:')
  })
})
