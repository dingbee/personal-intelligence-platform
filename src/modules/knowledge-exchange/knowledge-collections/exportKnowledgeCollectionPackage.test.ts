import { describe, expect, it } from 'vitest'
import {
  exportKnowledgeCollectionPackage,
  knowledgeCollectionPackageExporter,
  knowledgeCollectionPackageFilename,
} from '@/modules/knowledge-exchange/knowledge-collections/exportKnowledgeCollectionPackage'
import type { CollectionMemberEntry } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageTypes'
import type { KnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkPackageTypes'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

function fakeNodeMember(overrides: Partial<Extract<CollectionMemberEntry, { memberType: 'knowledge_node' }>> = {}): CollectionMemberEntry {
  return {
    memberType: 'knowledge_node',
    originalAddedAt: '2026-01-01T00:00:00.000Z',
    payload: {
      version: CURRENT_PACKAGE_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sourceVersion: PACKAGE_SOURCE_VERSION,
      node: {
        nodeType: 'concept',
        title: 'Photosynthesis',
        description: 'How plants make food.',
        metadata: null,
        generationMetadata: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
    ...overrides,
  }
}

function fakeConversationMember(): CollectionMemberEntry {
  return { memberType: 'conversation', originalAddedAt: '2026-01-02T00:00:00.000Z', unsupported: true, title: 'A chat about photosynthesis' }
}

function fakeRelationship(): KnowledgeLinkPackage {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    link: {
      relationshipType: 'requires',
      confidence: 0.9,
      generatedBy: 'ai:detect-relationships',
      source: { nodeType: 'concept', title: 'Photosynthesis', description: null },
      target: { nodeType: 'concept', title: 'Chlorophyll', description: null },
    },
  }
}

describe('exportKnowledgeCollectionPackage', () => {
  it('carries collection metadata, members, and relationships verbatim', () => {
    const members = [fakeNodeMember(), fakeConversationMember()]
    const relationships = [fakeRelationship()]
    const pkg = exportKnowledgeCollectionPackage({
      collection: { name: 'Plant Biology', description: 'Curated concepts about plants.' },
      members,
      relationships,
    })

    expect(pkg.version).toBe(CURRENT_PACKAGE_VERSION)
    expect(pkg.sourceVersion).toBe(PACKAGE_SOURCE_VERSION)
    expect(pkg.collection.name).toBe('Plant Biology')
    expect(pkg.collection.description).toBe('Curated concepts about plants.')
    expect(pkg.collection.members).toEqual(members)
    expect(pkg.collection.relationships).toEqual(relationships)
  })

  it('preserves a null description', () => {
    const pkg = exportKnowledgeCollectionPackage({ collection: { name: 'Untitled', description: null }, members: [], relationships: [] })
    expect(pkg.collection.description).toBeNull()
  })

  it('never embeds real content for a conversation member — only its title, marked unsupported', () => {
    const pkg = exportKnowledgeCollectionPackage({
      collection: { name: 'Mixed bag', description: null },
      members: [fakeConversationMember()],
      relationships: [],
    })
    const member = pkg.collection.members[0]!
    expect(member.memberType).toBe('conversation')
    expect(member).toEqual({ memberType: 'conversation', originalAddedAt: '2026-01-02T00:00:00.000Z', unsupported: true, title: 'A chat about photosynthesis' })
  })

  it('the knowledgeCollectionPackageExporter object delegates to the same function', () => {
    const source = { collection: { name: 'Plant Biology', description: null }, members: [fakeNodeMember()], relationships: [] }
    const pkg = knowledgeCollectionPackageExporter.export(source)
    expect(pkg.collection).toEqual(exportKnowledgeCollectionPackage(source).collection)
  })
})

describe('knowledgeCollectionPackageFilename', () => {
  it('slugifies the collection name into a safe .zip filename', () => {
    expect(knowledgeCollectionPackageFilename('Plant Biology')).toBe('plant-biology.zip')
  })

  it('falls back to a generic name for empty/symbol-only names', () => {
    expect(knowledgeCollectionPackageFilename('   ')).toBe('collection-export.zip')
  })
})
