import { describe, expect, it } from 'vitest'
import { buildNovaContextPrompt } from '@/modules/intelligence/buildNovaContextPrompt'
import type { NovaContext } from '@/modules/intelligence/context/types'

const EMPTY: NovaContext = {
  workspaceContext: null,
  activityContext: null,
  knowledgeContext: null,
  memoryContext: null,
  userContext: null,
  attentionContext: null,
}

describe('buildNovaContextPrompt', () => {
  it('always includes the personality block', () => {
    expect(buildNovaContextPrompt(EMPTY, 'What is this?')).toContain('You are NOVA')
  })

  it('always includes response-style guidance', () => {
    expect(buildNovaContextPrompt(EMPTY, 'Explain how this works.')).toContain('open-ended question')
  })

  it('includes a "Current context" section when situational context is available', () => {
    const context: NovaContext = {
      ...EMPTY,
      activityContext: { inProgressDocument: null, recentConversations: [{ id: 'conv-1', title: 'Topic A' }] },
    }
    const prompt = buildNovaContextPrompt(context, 'Continue')
    expect(prompt).toContain('Current context:')
    expect(prompt).toContain('Topic A')
  })

  it('omits the "Current context" section when nothing is available', () => {
    expect(buildNovaContextPrompt(EMPTY, 'Hello')).not.toContain('Current context:')
  })
})
