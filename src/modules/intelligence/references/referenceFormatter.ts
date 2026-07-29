import type { Reference } from '@/modules/intelligence/references/referenceTypes'

export interface FormattedReference {
  icon: string
  label: string
  typeLabel: string
  href: string
}

/** UX-7 Phase 3 — reference -> chip display data. Reuses existing routes (/library/:id, /library/:id/read?chapter=N, /notes/:id, /chat?conversationId=) — no new navigation logic. */
export function formatReference(reference: Reference): FormattedReference {
  switch (reference.type) {
    case 'document':
      return { icon: '📄', label: reference.title, typeLabel: 'Document', href: `/library/${reference.id}` }
    case 'chapter':
      return {
        icon: '📖',
        label: reference.chapterTitle,
        typeLabel: reference.documentTitle,
        href: `/library/${reference.documentId}/read?chapter=${reference.chapterIndex}`,
      }
    case 'note':
      return { icon: '📝', label: reference.title, typeLabel: 'Note', href: `/notes/${reference.id}` }
    case 'conversation':
      return { icon: '💬', label: reference.title, typeLabel: 'Conversation', href: `/chat?conversationId=${reference.id}` }
  }
}
