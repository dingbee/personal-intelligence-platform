import { describe, expect, it } from 'vitest'
import { formatReference } from '@/modules/intelligence/references/referenceFormatter'
import type { Reference } from '@/modules/intelligence/references/referenceTypes'

describe('formatReference', () => {
  it('formats a document reference', () => {
    const reference: Reference = { type: 'document', id: 'doc-1', title: 'Report' }
    expect(formatReference(reference)).toEqual({ icon: '📄', label: 'Report', typeLabel: 'Document', href: '/library/doc-1' })
  })

  it('formats a chapter reference with a chapter-scoped reader deep link', () => {
    const reference: Reference = {
      type: 'chapter',
      documentId: 'doc-1',
      documentTitle: 'Atomic Habits',
      chapterIndex: 3,
      chapterTitle: 'The Turning Point',
    }
    expect(formatReference(reference)).toEqual({
      icon: '📖',
      label: 'The Turning Point',
      typeLabel: 'Atomic Habits',
      href: '/library/doc-1/read?chapter=3',
    })
  })

  it('formats a note reference', () => {
    const reference: Reference = { type: 'note', id: 'note-1', title: 'Meeting notes' }
    expect(formatReference(reference)).toEqual({ icon: '📝', label: 'Meeting notes', typeLabel: 'Note', href: '/notes/note-1' })
  })

  it('formats a conversation reference', () => {
    const reference: Reference = { type: 'conversation', id: 'conv-1', title: 'Marketing plan' }
    expect(formatReference(reference)).toEqual({
      icon: '💬',
      label: 'Marketing plan',
      typeLabel: 'Conversation',
      href: '/chat?conversationId=conv-1',
    })
  })
})
