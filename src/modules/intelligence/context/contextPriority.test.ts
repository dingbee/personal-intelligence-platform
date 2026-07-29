import { describe, expect, it } from 'vitest'
import { rankNovaContext } from '@/modules/intelligence/context/contextPriority'
import type { NovaContext } from '@/modules/intelligence/context/types'

const EMPTY: NovaContext = {
  workspaceContext: null,
  activityContext: null,
  knowledgeContext: null,
  memoryContext: null,
  userContext: null,
  attentionContext: null,
}

describe('rankNovaContext', () => {
  it('returns an empty list when nothing is available', () => {
    expect(rankNovaContext(EMPTY)).toEqual([])
  })

  it('ranks memory above activity above knowledge above workspace above user', () => {
    const full: NovaContext = {
      workspaceContext: { workspaceId: 'w1', workspaceName: 'Research', documentCount: 2, lastActivityAt: null },
      activityContext: { inProgressDocument: null, recentConversations: [{ id: 'conv-1', title: 'Topic A' }] },
      knowledgeContext: { graphSummary: 'text', nodeCount: 2 },
      memoryContext: { formattedText: 'text', memoryCount: 1 },
      userContext: { displayName: 'Ding' },
      attentionContext: null,
    }
    expect(rankNovaContext(full).map((r) => r.key)).toEqual([
      'memoryContext',
      'activityContext',
      'knowledgeContext',
      'workspaceContext',
      'userContext',
    ])
  })

  it('ranks attentionContext between activity and knowledge', () => {
    const context: NovaContext = { ...EMPTY, attentionContext: { topItem: { message: 'Finish your book' } } }
    expect(rankNovaContext(context).map((r) => r.key)).toEqual(['attentionContext'])
  })

  it('omits workspaceContext when it has no workspace name (the "All" scope)', () => {
    const context: NovaContext = {
      ...EMPTY,
      workspaceContext: { workspaceId: null, workspaceName: null, documentCount: 5, lastActivityAt: null },
    }
    expect(rankNovaContext(context)).toEqual([])
  })

  it('omits activityContext when there is no in-progress document and no recent conversations', () => {
    const context: NovaContext = { ...EMPTY, activityContext: { inProgressDocument: null, recentConversations: [] } }
    expect(rankNovaContext(context)).toEqual([])
  })

  it('includes activityContext when only recent conversations are present', () => {
    const context: NovaContext = {
      ...EMPTY,
      activityContext: { inProgressDocument: null, recentConversations: [{ id: 'conv-1', title: 'Topic A' }] },
    }
    expect(rankNovaContext(context).map((r) => r.key)).toEqual(['activityContext'])
  })
})
