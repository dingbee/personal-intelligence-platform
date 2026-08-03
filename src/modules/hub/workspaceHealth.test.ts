import { describe, expect, it } from 'vitest'
import { computeWorkspaceHealth } from '@/modules/hub/workspaceHealth'
import type { NoteWithDocument } from '@/modules/notes/api/notes'
import type { DocumentWithTags } from '@/modules/library/api/documents'
import type { KnowledgeCollection, KnowledgeLink, KnowledgeNode } from '@/shared/types/database'

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
  taggedNoteIds: new Set<string>(),
  knowledgeNodes: [],
  edges: [],
  collections: [],
  readDocumentCount: 0,
  totalReadyDocumentCount: 0,
  now: NOW,
}

describe('computeWorkspaceHealth', () => {
  it('reports "unknown"/empty-state indicators for a brand-new workspace', () => {
    const indicators = computeWorkspaceHealth(emptyInput)
    expect(indicators.find((i) => i.id === 'knowledge-connectedness')?.status).toBe('unknown')
    expect(indicators.find((i) => i.id === 'untagged-notes')?.value).toBe('No notes yet')
    expect(indicators.find((i) => i.id === 'orphaned-documents')?.value).toBe('No documents yet')
    expect(indicators.find((i) => i.id === 'empty-collections')?.value).toBe('No collections yet')
  })

  it('always reports export/backup status as not tracked, regardless of other data', () => {
    const indicators = computeWorkspaceHealth(emptyInput)
    const exportStatus = indicators.find((i) => i.id === 'export-backup-status')
    expect(exportStatus?.status).toBe('unknown')
    expect(exportStatus?.value).toBe('Not tracked')
  })

  it('computes knowledge connectedness from AI-generated edges only', () => {
    const indicators = computeWorkspaceHealth({
      ...emptyInput,
      knowledgeNodes: [makeNode({ id: 'a' }), makeNode({ id: 'b' }), makeNode({ id: 'isolated' })],
      edges: [makeEdge({ source_id: 'a', target_id: 'b', generated_by: 'ai:detect-relationships' })],
    })
    expect(indicators.find((i) => i.id === 'knowledge-connectedness')?.value).toBe('2 / 3')
  })

  it('counts a note with no tag id in taggedNoteIds as untagged', () => {
    const indicators = computeWorkspaceHealth({
      ...emptyInput,
      notes: [makeNote({ id: 'tagged' }), makeNote({ id: 'untagged' })],
      taggedNoteIds: new Set(['tagged']),
    })
    expect(indicators.find((i) => i.id === 'untagged-notes')?.value).toBe('1 / 2')
    expect(indicators.find((i) => i.id === 'untagged-notes')?.status).toBe('warning')
  })

  it('reports good status when every note is tagged', () => {
    const indicators = computeWorkspaceHealth({
      ...emptyInput,
      notes: [makeNote({ id: 'tagged' })],
      taggedNoteIds: new Set(['tagged']),
    })
    expect(indicators.find((i) => i.id === 'untagged-notes')?.status).toBe('good')
  })

  it('flags a document with neither collection nor tags as orphaned', () => {
    const indicators = computeWorkspaceHealth({
      ...emptyInput,
      documents: [makeDocument({ id: 'orphan', collection_id: null, tags: [] }), makeDocument({ id: 'organized', collection_id: 'col-1' })],
    })
    expect(indicators.find((i) => i.id === 'orphaned-documents')?.value).toBe('1 / 2')
  })

  it('does not count a document with only tags (no collection) as orphaned', () => {
    const indicators = computeWorkspaceHealth({
      ...emptyInput,
      documents: [makeDocument({ id: 'tagged-only', collection_id: null, tags: [{ id: 't1', name: 'tag' }] })],
    })
    expect(indicators.find((i) => i.id === 'orphaned-documents')?.value).toBe('0 / 1')
  })

  it('flags a collection with zero membership links as empty', () => {
    const indicators = computeWorkspaceHealth({
      ...emptyInput,
      collections: [makeCollection({ id: 'empty' }), makeCollection({ id: 'populated' })],
      edges: [makeEdge({ source_type: 'knowledge_collection', source_id: 'populated' })],
    })
    expect(indicators.find((i) => i.id === 'empty-collections')?.value).toBe('1 / 2')
  })

  it('passes through the caller-supplied reading progress counts unchanged', () => {
    const indicators = computeWorkspaceHealth({ ...emptyInput, readDocumentCount: 3, totalReadyDocumentCount: 5 })
    expect(indicators.find((i) => i.id === 'reading-progress')?.value).toBe('3 / 5')
  })

  it('counts recently imported notes and knowledge nodes together within the 30-day window', () => {
    const indicators = computeWorkspaceHealth({
      ...emptyInput,
      notes: [makeNote({ id: 'n1', generation_metadata: { importedFrom: { importedAt: '2025-06-10T00:00:00Z' } } })],
      knowledgeNodes: [makeNode({ id: 'k1', generation_metadata: { importedFrom: { importedAt: '2025-06-01T00:00:00Z' } } })],
    })
    expect(indicators.find((i) => i.id === 'recent-imports')?.value).toBe('2')
  })

  it('excludes an import older than 30 days from the recent-imports count', () => {
    const indicators = computeWorkspaceHealth({
      ...emptyInput,
      notes: [makeNote({ id: 'n1', generation_metadata: { importedFrom: { importedAt: '2025-01-01T00:00:00Z' } } })],
    })
    expect(indicators.find((i) => i.id === 'recent-imports')?.value).toBe('0')
  })

  it('computes AI indexing progress as the ready fraction of all documents', () => {
    const indicators = computeWorkspaceHealth({
      ...emptyInput,
      documents: [makeDocument({ id: 'd1', status: 'ready' }), makeDocument({ id: 'd2', status: 'processing' })],
    })
    expect(indicators.find((i) => i.id === 'ai-indexing-progress')?.value).toBe('1 / 2')
  })
})
