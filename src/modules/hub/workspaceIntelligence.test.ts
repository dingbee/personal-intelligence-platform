import { describe, expect, it } from 'vitest'
import { computeWorkspaceIntelligence } from '@/modules/hub/workspaceIntelligence'
import type { NoteWithDocument } from '@/modules/notes/api/notes'
import type { DocumentWithTags } from '@/modules/library/api/documents'
import type { Conversation, KnowledgeCollection, KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

const NOW = new Date('2025-06-15T00:00:00Z')

function makeNote(overrides: Partial<NoteWithDocument> = {}): NoteWithDocument {
  return {
    id: 'note-1',
    user_id: 'user-1',
    workspace_id: 'ws-1',
    collection_id: null,
    document_id: null,
    title: 'A note',
    content: 'content',
    source_chunk_ids: null,
    generation_metadata: null,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    document: null,
    ...overrides,
  }
}

function makeDocument(overrides: Partial<DocumentWithTags> = {}): DocumentWithTags {
  return {
    id: 'doc-1',
    user_id: 'user-1',
    workspace_id: 'ws-1',
    collection_id: null,
    title: 'A document',
    file_name: 'document.pdf',
    file_path: 'path/document.pdf',
    file_type: 'pdf',
    file_size: 100,
    status: 'ready',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    tags: [],
    ...overrides,
  }
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    user_id: 'user-1',
    workspace_id: 'ws-1',
    document_id: null,
    title: 'A conversation',
    provider_id: 'openai',
    archived_at: null,
    is_pinned: false,
    favorite: false,
    color: null,
    icon: null,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    ...overrides,
  }
}

function makeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id: 'node-1',
    user_id: 'user-1',
    workspace_id: 'ws-1',
    node_type: 'concept',
    title: 'A concept',
    title_normalized: 'a concept',
    description: null,
    source_type: 'document',
    source_id: 'doc-1',
    source_chunk_ids: null,
    generation_metadata: null,
    metadata: null,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    ...overrides,
  }
}

function makeEdge(overrides: Partial<KnowledgeLink> = {}): KnowledgeLink {
  return {
    id: 'edge-1',
    user_id: 'user-1',
    workspace_id: 'ws-1',
    source_type: 'knowledge_node',
    source_id: 'node-1',
    target_type: 'knowledge_node',
    target_id: 'node-2',
    created_at: '2025-06-01T00:00:00Z',
    relationship_type: null,
    confidence: null,
    generated_by: 'ai:detect-relationships',
    metadata: null,
    ...overrides,
  }
}

function makeCollection(overrides: Partial<KnowledgeCollection> = {}): KnowledgeCollection {
  return {
    id: 'collection-1',
    user_id: 'user-1',
    workspace_id: 'ws-1',
    name: 'A collection',
    description: null,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    ...overrides,
  }
}

const emptyInput = {
  documents: [],
  notes: [],
  knowledgeNodes: [],
  edges: [],
  collections: [],
  activeConversations: [],
  currentUserId: 'user-1',
  now: NOW,
}

describe('computeWorkspaceIntelligence', () => {
  it('returns nothing for a workspace with no signals', () => {
    expect(computeWorkspaceIntelligence(emptyInput)).toEqual([])
  })

  it('flags documents not yet ready as needing attention', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      documents: [makeDocument({ status: 'processing' }), makeDocument({ id: 'doc-2', status: 'ready' })],
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ zone: 'attention', id: 'attention-documents-processing' })
    expect(items[0]!.description).toContain('Still uploading')
  })

  it('calls out a processing failure distinctly from a normal in-progress document', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      documents: [makeDocument({ status: 'error' })],
    })
    expect(items[0]!.description).toContain('failed')
  })

  it('flags knowledge nodes with zero AI-generated connections', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      knowledgeNodes: [makeNode({ id: 'isolated', title: 'Isolated' }), makeNode({ id: 'connected-a' }), makeNode({ id: 'connected-b' })],
      edges: [makeEdge({ source_id: 'connected-a', target_id: 'connected-b', generated_by: 'ai:detect-relationships' })],
    })
    const attentionItem = items.find((i) => i.id === 'attention-unlinked-nodes')
    expect(attentionItem?.title).toContain('1 concept')
  })

  it('does not count a user-authored (non-AI-generated) edge toward connectivity', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      knowledgeNodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' })],
      edges: [makeEdge({ source_id: 'a', target_id: 'b', generated_by: null })],
    })
    const attentionItem = items.find((i) => i.id === 'attention-unlinked-nodes')
    expect(attentionItem?.title).toContain('2 concepts')
  })

  it('surfaces a pinned conversation gone stale as needing follow-up', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      activeConversations: [makeConversation({ id: 'stale', is_pinned: true, updated_at: '2025-05-01T00:00:00Z' })],
    })
    expect(items.some((i) => i.id === 'attention-followup-stale')).toBe(true)
  })

  it('does not flag a recently-updated pinned conversation', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      activeConversations: [makeConversation({ id: 'fresh', is_pinned: true, updated_at: '2025-06-14T00:00:00Z' })],
    })
    expect(items.some((i) => i.id.startsWith('attention-followup'))).toBe(false)
  })

  it('does not flag an unpinned, unfavorited stale conversation', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      activeConversations: [makeConversation({ id: 'stale-unpinned', updated_at: '2025-05-01T00:00:00Z' })],
    })
    expect(items).toEqual([])
  })

  it('flags a collection that gained enough members recently as growing quickly', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      collections: [makeCollection({ id: 'growing' })],
      edges: [
        makeEdge({ source_type: 'knowledge_collection', source_id: 'growing', created_at: '2025-06-10T00:00:00Z' }),
        makeEdge({ source_type: 'knowledge_collection', source_id: 'growing', created_at: '2025-06-11T00:00:00Z' }),
        makeEdge({ source_type: 'knowledge_collection', source_id: 'growing', created_at: '2025-06-12T00:00:00Z' }),
      ],
    })
    expect(items.some((i) => i.id === 'organize-collection-growth-growing')).toBe(true)
  })

  it('does not flag a collection below the rapid-growth threshold', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      collections: [makeCollection({ id: 'slow' })],
      edges: [makeEdge({ source_type: 'knowledge_collection', source_id: 'slow', created_at: '2025-06-10T00:00:00Z' })],
    })
    expect(items).toEqual([])
  })

  it('surfaces a note referenced from several other items as frequently referenced', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      notes: [makeNote({ id: 'popular', title: 'Popular note' })],
      edges: [
        makeEdge({ source_type: 'note', source_id: 'popular', target_type: 'conversation', target_id: 'c1' }),
        makeEdge({ source_type: 'highlight', source_id: 'h1', target_type: 'note', target_id: 'popular' }),
        makeEdge({ source_type: 'asset', source_id: 'a1', target_type: 'note', target_id: 'popular' }),
      ],
    })
    expect(items.some((i) => i.id === 'organize-frequently-referenced-popular')).toBe(true)
  })

  it("surfaces a teammate's recent note or conversation under Shared With You", () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      notes: [makeNote({ id: 'teammate-note', user_id: 'user-2' })],
      activeConversations: [makeConversation({ id: 'own-conv', user_id: 'user-1' })],
    })
    expect(items).toEqual([expect.objectContaining({ id: 'shared-note-teammate-note', zone: 'shared' })])
  })

  it('surfaces a recently-imported note under Recently Learned', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      notes: [
        makeNote({
          id: 'imported',
          generation_metadata: { importedFrom: { importedAt: '2025-06-10T00:00:00Z' } },
        }),
      ],
    })
    expect(items.some((i) => i.id === 'learned-imported-note-imported')).toBe(true)
  })

  it('does not surface an import older than the recency window', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      notes: [
        makeNote({
          id: 'old-import',
          generation_metadata: { importedFrom: { importedAt: '2025-01-01T00:00:00Z' } },
        }),
      ],
    })
    expect(items).toEqual([])
  })

  it('surfaces a recently-imported knowledge node under Recently Learned', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      knowledgeNodes: [
        makeNode({
          id: 'imported-node',
          generation_metadata: { importedFrom: { importedAt: '2025-06-12T00:00:00Z' } },
        }),
      ],
    })
    expect(items.some((i) => i.id === 'learned-imported-node-imported-node')).toBe(true)
  })

  it('sorts every item newest-timestamp-first regardless of zone', () => {
    const items = computeWorkspaceIntelligence({
      ...emptyInput,
      documents: [makeDocument({ status: 'processing', created_at: '2025-06-01T00:00:00Z' })],
      notes: [makeNote({ id: 'imported', generation_metadata: { importedFrom: { importedAt: '2025-06-14T00:00:00Z' } } })],
    })
    expect(items[0]!.id).toBe('learned-imported-note-imported')
    expect(items[1]!.id).toBe('attention-documents-processing')
  })
})
