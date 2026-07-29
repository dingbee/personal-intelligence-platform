import { describe, expect, it } from 'vitest'
import { formatNovaContext } from '@/modules/intelligence/context/contextFormatter'
import type { NovaContext } from '@/modules/intelligence/context/types'

const EMPTY: NovaContext = {
  workspaceContext: null,
  activityContext: null,
  knowledgeContext: null,
  memoryContext: null,
  userContext: null,
}

describe('formatNovaContext', () => {
  it('returns null when nothing is available', () => {
    expect(formatNovaContext(EMPTY)).toBeNull()
  })

  it('never renders memoryContext content directly (already in <personal_context>)', () => {
    const context: NovaContext = { ...EMPTY, memoryContext: { formattedText: 'Likes concise answers', memoryCount: 1 } }
    expect(formatNovaContext(context)).toBeNull()
  })

  it('renders the in-progress document', () => {
    const context: NovaContext = {
      ...EMPTY,
      activityContext: {
        inProgressDocument: { id: 'doc-1', title: 'Deep Work', updatedAt: new Date().toISOString() },
        recentConversations: [],
      },
    }
    expect(formatNovaContext(context)).toContain('Deep Work')
  })

  it('renders recent conversation topics', () => {
    const context: NovaContext = {
      ...EMPTY,
      activityContext: { inProgressDocument: null, recentConversations: [{ id: 'conv-1', title: 'Renaissance architecture' }] },
    }
    expect(formatNovaContext(context)).toContain('Renaissance architecture')
  })

  it('renders knowledge and workspace context in priority order (activity before knowledge before workspace)', () => {
    const context: NovaContext = {
      ...EMPTY,
      activityContext: { inProgressDocument: null, recentConversations: [{ id: 'conv-1', title: 'Topic A' }] },
      knowledgeContext: { graphSummary: 'text', nodeCount: 4 },
      workspaceContext: { workspaceId: 'w1', workspaceName: 'Research Notes', documentCount: 12, lastActivityAt: null },
    }
    const result = formatNovaContext(context)
    expect(result).not.toBeNull()
    const activityIndex = result!.indexOf('Topic A')
    const knowledgeIndex = result!.indexOf('knowledge connection')
    const workspaceIndex = result!.indexOf('Research Notes')
    expect(activityIndex).toBeGreaterThanOrEqual(0)
    expect(activityIndex).toBeLessThan(knowledgeIndex)
    expect(knowledgeIndex).toBeLessThan(workspaceIndex)
  })

  it('omits workspaceContext with no name (the "All" scope)', () => {
    const context: NovaContext = {
      ...EMPTY,
      workspaceContext: { workspaceId: null, workspaceName: null, documentCount: 3, lastActivityAt: null },
    }
    expect(formatNovaContext(context)).toBeNull()
  })
})
