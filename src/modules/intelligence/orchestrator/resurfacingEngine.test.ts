import { describe, expect, it } from 'vitest'
import { resurfaceKnowledge } from '@/modules/intelligence/orchestrator/resurfacingEngine'

describe('resurfaceKnowledge', () => {
  it('returns nothing when there is no data', () => {
    expect(resurfaceKnowledge({ inProgressDocument: null, recentNotes: [], recentConversations: [] })).toEqual([])
  })

  it('includes the in-progress document with a reader link', () => {
    const items = resurfaceKnowledge({
      inProgressDocument: { id: 'doc-1', title: 'Deep Work', scrollFraction: 0.4 },
      recentNotes: [],
      recentConversations: [],
    })
    expect(items).toContainEqual({ type: 'document', id: 'doc-1', title: 'Deep Work', href: '/library/doc-1/read' })
  })

  it('omits an in-progress document that has not actually been opened (scrollFraction 0)', () => {
    const items = resurfaceKnowledge({
      inProgressDocument: { id: 'doc-1', title: 'Deep Work', scrollFraction: 0 },
      recentNotes: [],
      recentConversations: [],
    })
    expect(items.some((i) => i.type === 'document')).toBe(false)
  })

  it('includes recent notes with note links', () => {
    const items = resurfaceKnowledge({
      inProgressDocument: null,
      recentNotes: [{ id: 'note-1', title: 'Meeting notes' }],
      recentConversations: [],
    })
    expect(items).toContainEqual({ type: 'note', id: 'note-1', title: 'Meeting notes', href: '/notes/note-1' })
  })

  it('includes recent conversations with chat links', () => {
    const items = resurfaceKnowledge({
      inProgressDocument: null,
      recentNotes: [],
      recentConversations: [{ id: 'conv-1', title: 'Marketing plan' }],
    })
    expect(items).toContainEqual({
      type: 'conversation',
      id: 'conv-1',
      title: 'Marketing plan',
      href: '/chat?conversationId=conv-1',
    })
  })

  it('combines all three sources', () => {
    const items = resurfaceKnowledge({
      inProgressDocument: { id: 'doc-1', title: 'Deep Work', scrollFraction: 0.4 },
      recentNotes: [{ id: 'note-1', title: 'Meeting notes' }],
      recentConversations: [{ id: 'conv-1', title: 'Marketing plan' }],
    })
    expect(items).toHaveLength(3)
  })
})
