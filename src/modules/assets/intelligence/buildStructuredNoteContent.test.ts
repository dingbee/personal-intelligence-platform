import { describe, expect, it } from 'vitest'
import { buildStructuredNoteContent } from '@/modules/assets/intelligence/buildStructuredNoteContent'
import type { DocumentIntelligence } from '@/shared/types/database'

function makeDocumentIntelligence(overrides: Partial<DocumentIntelligence> = {}): DocumentIntelligence {
  return {
    documentType: 'meeting notes',
    dates: [],
    decisions: [],
    tasks: [],
    analyzedAt: '2026-01-01T00:00:00.000Z',
    provider: 'openai',
    ...overrides,
  }
}

describe('buildStructuredNoteContent', () => {
  it('always starts with the image description', () => {
    const content = buildStructuredNoteContent({ description: 'A whiteboard with a project plan.', documentIntelligence: null })
    expect(content).toBe('A whiteboard with a project plan.')
  })

  it('renders tasks as a real markdown checklist, not a fabricated task entity', () => {
    const content = buildStructuredNoteContent({
      description: 'A handwritten meeting note.',
      documentIntelligence: makeDocumentIntelligence({ tasks: [{ description: 'Send proposal', owner: 'John' }] }),
    })
    expect(content).toContain('## Tasks')
    expect(content).toContain('- [ ] Send proposal (John)')
  })

  it('omits the owner parenthetical when no owner was stated', () => {
    const content = buildStructuredNoteContent({
      description: 'A note.',
      documentIntelligence: makeDocumentIntelligence({ tasks: [{ description: 'Follow up', owner: null }] }),
    })
    expect(content).toContain('- [ ] Follow up')
    expect(content).not.toContain('- [ ] Follow up (')
  })

  it('renders dates and decisions as their own sections', () => {
    const content = buildStructuredNoteContent({
      description: 'A business plan sketch.',
      documentIntelligence: makeDocumentIntelligence({
        dates: [{ label: 'Launch', date: 'June 2026' }],
        decisions: ['Proceed with the booking engine vendor'],
      }),
    })
    expect(content).toContain('## Dates')
    expect(content).toContain('- **Launch:** June 2026')
    expect(content).toContain('## Decisions')
    expect(content).toContain('- Proceed with the booking engine vendor')
  })

  it('omits a section entirely when its array is empty, rather than rendering an empty heading', () => {
    const content = buildStructuredNoteContent({ description: 'A note.', documentIntelligence: makeDocumentIntelligence() })
    expect(content).toBe('A note.')
    expect(content).not.toContain('##')
  })
})
