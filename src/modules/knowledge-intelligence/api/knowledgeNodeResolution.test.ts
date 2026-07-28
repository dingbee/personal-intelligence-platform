import { describe, expect, it } from 'vitest'
import { decideResolutionAction } from '@/modules/knowledge-intelligence/api/knowledgeNodeResolution'

describe('decideResolutionAction', () => {
  it('creates a new node when nothing exists for this identity yet', () => {
    expect(decideResolutionAction(null, { sourceType: 'document', sourceId: 'doc-1' })).toBe('create')
  })

  it('refreshes an existing node when the exact same source resolves again (e.g. reprocessing the same document)', () => {
    const existing = { source_type: 'document', source_id: 'doc-1' }
    expect(decideResolutionAction(existing, { sourceType: 'document', sourceId: 'doc-1' })).toBe('refresh')
  })

  it('reuses (without overwriting) an existing node when a different source resolves to it — the cross-document merge case', () => {
    const existing = { source_type: 'document', source_id: 'doc-1' }
    expect(decideResolutionAction(existing, { sourceType: 'document', sourceId: 'doc-2' })).toBe('reuse')
  })

  it('treats a different source_type as a different source even with the same source_id', () => {
    const existing = { source_type: 'document', source_id: 'shared-id' }
    expect(decideResolutionAction(existing, { sourceType: 'note', sourceId: 'shared-id' })).toBe('reuse')
  })

  it('is deterministic — the same inputs always produce the same decision', () => {
    const existing = { source_type: 'document', source_id: 'doc-1' }
    const input = { sourceType: 'document', sourceId: 'doc-1' }
    expect(decideResolutionAction(existing, input)).toBe(decideResolutionAction(existing, input))
  })
})
