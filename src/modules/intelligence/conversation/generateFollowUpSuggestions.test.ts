import { describe, expect, it } from 'vitest'
import { generateFollowUpSuggestions } from '@/modules/intelligence/conversation/generateFollowUpSuggestions'
import type { NovaContext } from '@/modules/intelligence/context/types'

const EMPTY: NovaContext = {
  workspaceContext: null,
  activityContext: null,
  knowledgeContext: null,
  memoryContext: null,
  userContext: null,
}

describe('generateFollowUpSuggestions', () => {
  it('returns no suggestions when nothing justifies one', () => {
    expect(generateFollowUpSuggestions({ matchCount: 0, context: EMPTY })).toEqual([])
  })

  it('suggests notes when documents matched', () => {
    expect(generateFollowUpSuggestions({ matchCount: 3, context: EMPTY })).toEqual(['Create notes from this?'])
  })

  it('suggests exploring related concepts when knowledge context is present', () => {
    const context: NovaContext = { ...EMPTY, knowledgeContext: { graphSummary: 'text', nodeCount: 2 } }
    expect(generateFollowUpSuggestions({ matchCount: 0, context })).toEqual(['Explore related concepts?'])
  })

  it('suggests continuing reading, naming the in-progress document', () => {
    const context: NovaContext = {
      ...EMPTY,
      activityContext: {
        inProgressDocument: { id: 'doc-1', title: 'Deep Work', updatedAt: new Date().toISOString() },
        recentConversations: [],
      },
    }
    expect(generateFollowUpSuggestions({ matchCount: 0, context })).toEqual(['Continue reading "Deep Work"?'])
  })

  it('combines every applicable suggestion', () => {
    const context: NovaContext = {
      ...EMPTY,
      knowledgeContext: { graphSummary: 'text', nodeCount: 1 },
      activityContext: {
        inProgressDocument: { id: 'doc-1', title: 'Deep Work', updatedAt: new Date().toISOString() },
        recentConversations: [],
      },
    }
    expect(generateFollowUpSuggestions({ matchCount: 2, context })).toEqual([
      'Create notes from this?',
      'Explore related concepts?',
      'Continue reading "Deep Work"?',
    ])
  })
})
