import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import { buildCollectionPackageZip, COLLECTION_PACKAGE_MANIFEST_ENTRY } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageArchive'
import { parseKnowledgeCollectionPackageZip } from '@/modules/knowledge-exchange/knowledge-collections/validateKnowledgeCollectionPackage'
import type { CollectionPackageManifest } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageTypes'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import { buildDocumentPackageZip } from '@/modules/knowledge-exchange/documents/documentPackageArchive'
import type { DocumentPackageManifest } from '@/modules/knowledge-exchange/documents/documentPackageTypes'

vi.mock('@/modules/processing/pipeline/downloadFile', () => ({ downloadDocumentFile: vi.fn() }))

function fakeNodeMember() {
  return {
    memberType: 'knowledge_node' as const,
    originalAddedAt: '2026-01-01T00:00:00.000Z',
    payload: {
      version: CURRENT_PACKAGE_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sourceVersion: PACKAGE_SOURCE_VERSION,
      node: {
        nodeType: 'concept' as const,
        title: 'Photosynthesis',
        description: null,
        metadata: null,
        generationMetadata: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    },
  }
}

function fakeManifest(overrides: Partial<CollectionPackageManifest['collection']> = {}): CollectionPackageManifest {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    collection: { name: 'Plant Biology', description: null, members: [fakeNodeMember()], relationships: [], ...overrides },
  }
}

function fakeConversationMember() {
  return {
    memberType: 'conversation' as const,
    originalAddedAt: '2026-01-01T00:00:00.000Z',
    payload: {
      version: CURRENT_PACKAGE_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      sourceVersion: PACKAGE_SOURCE_VERSION,
      conversation: {
        title: 'A chat about photosynthesis',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        messages: [{ role: 'user' as const, content: 'What is photosynthesis?', createdAt: '2026-01-01T00:00:01.000Z' }],
      },
    },
  }
}

function fakeDocumentManifest(): DocumentPackageManifest {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    document: { title: 'Field Notes', fileName: 'field-notes.pdf', fileType: 'pdf', sizeBytes: 5, createdAt: '2026-01-01T00:00:00.000Z', tags: [] },
  }
}

async function toBlob(zip: JSZip): Promise<Blob> {
  return zip.generateAsync({ type: 'blob' })
}

describe('parseKnowledgeCollectionPackageZip', () => {
  it('accepts a well-formed package with a knowledge_node member and a relationship', async () => {
    const manifest = fakeManifest({
      relationships: [
        {
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
        },
      ],
    })
    const blob = await buildCollectionPackageZip(manifest, [])
    const result = await parseKnowledgeCollectionPackageZip(blob)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.package.manifest.collection.name).toBe('Plant Biology')
    expect(result.package.manifest.collection.relationships).toHaveLength(1)
    expect(result.package.documentMembers.size).toBe(0)
  })

  it('accepts a document member whose nested archive parses cleanly', async () => {
    const documentManifest = fakeDocumentManifest()
    const nestedZipBlob = await buildDocumentPackageZip(documentManifest, new Blob(['hello']))
    const manifest = fakeManifest({
      members: [
        { memberType: 'document', originalAddedAt: '2026-01-01T00:00:00.000Z', payload: documentManifest, archiveEntry: 'document-members/0.zip' },
      ],
    })
    const blob = await buildCollectionPackageZip(manifest, [nestedZipBlob])
    const result = await parseKnowledgeCollectionPackageZip(blob)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.package.documentMembers.has('document-members/0.zip')).toBe(true)
  })

  it('rejects a package whose nested document archive is missing entirely', async () => {
    const documentManifest = fakeDocumentManifest()
    const manifest = fakeManifest({
      members: [
        { memberType: 'document', originalAddedAt: '2026-01-01T00:00:00.000Z', payload: documentManifest, archiveEntry: 'document-members/0.zip' },
      ],
    })
    // Build the outer zip directly, omitting the referenced nested entry.
    const zip = new JSZip()
    zip.file(COLLECTION_PACKAGE_MANIFEST_ENTRY, JSON.stringify(manifest))
    const blob = await toBlob(zip)

    const result = await parseKnowledgeCollectionPackageZip(blob)
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.some((i) => i.message.includes('missing the embedded document archive'))).toBe(true)
  })

  it('rejects a package whose nested document archive is itself corrupt', async () => {
    const documentManifest = fakeDocumentManifest()
    const manifest = fakeManifest({
      members: [
        { memberType: 'document', originalAddedAt: '2026-01-01T00:00:00.000Z', payload: documentManifest, archiveEntry: 'document-members/0.zip' },
      ],
    })
    const zip = new JSZip()
    zip.file(COLLECTION_PACKAGE_MANIFEST_ENTRY, JSON.stringify(manifest))
    zip.file('document-members/0.zip', 'not a real zip archive')
    const blob = await toBlob(zip)

    const result = await parseKnowledgeCollectionPackageZip(blob)
    expect(result.valid).toBe(false)
  })

  it('rejects duplicate archive entries across document members', async () => {
    const documentManifest = fakeDocumentManifest()
    const nestedZipBlob = await buildDocumentPackageZip(documentManifest, new Blob(['hello']))
    const manifest = fakeManifest({
      members: [
        { memberType: 'document', originalAddedAt: '2026-01-01T00:00:00.000Z', payload: documentManifest, archiveEntry: 'document-members/0.zip' },
        { memberType: 'document', originalAddedAt: '2026-01-01T00:00:00.000Z', payload: documentManifest, archiveEntry: 'document-members/0.zip' },
      ],
    })
    const blob = await buildCollectionPackageZip(manifest, [nestedZipBlob])
    const result = await parseKnowledgeCollectionPackageZip(blob)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues.some((i) => i.message.includes('Duplicate member identifiers'))).toBe(true)
  })

  it('rejects an unrecognized member type', async () => {
    const manifest = { ...fakeManifest(), collection: { ...fakeManifest().collection, members: [{ memberType: 'flashcard', originalAddedAt: '2026-01-01T00:00:00.000Z', payload: {} }] } }
    const zip = new JSZip()
    zip.file(COLLECTION_PACKAGE_MANIFEST_ENTRY, JSON.stringify(manifest))
    const blob = await toBlob(zip)

    const result = await parseKnowledgeCollectionPackageZip(blob)
    expect(result.valid).toBe(false)
  })

  it('accepts a conversation member with a well-formed conversation package payload', async () => {
    const manifest = fakeManifest({ members: [fakeConversationMember()] })
    const blob = await buildCollectionPackageZip(manifest, [])
    const result = await parseKnowledgeCollectionPackageZip(blob)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.package.manifest.collection.members[0]).toEqual(fakeConversationMember())
  })

  it('rejects a conversation member whose payload has no messages', async () => {
    const badMember = fakeConversationMember()
    badMember.payload.conversation.messages = []
    const manifest = fakeManifest({ members: [badMember] })
    const blob = await buildCollectionPackageZip(manifest, [])
    const result = await parseKnowledgeCollectionPackageZip(blob)

    expect(result.valid).toBe(false)
  })

  it('rejects an unsupported package version', async () => {
    const manifest = { ...fakeManifest(), version: 999 }
    const blob = await buildCollectionPackageZip(manifest, [])
    const result = await parseKnowledgeCollectionPackageZip(blob)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues[0]!.code).toBe('future_version')
  })

  it('rejects a package with no manifest entry at all', async () => {
    const zip = new JSZip()
    zip.file('something-else.json', '{}')
    const blob = await toBlob(zip)

    const result = await parseKnowledgeCollectionPackageZip(blob)
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues[0]!.message).toContain('missing its manifest')
  })

  it('rejects a malformed (non-JSON) manifest', async () => {
    const zip = new JSZip()
    zip.file(COLLECTION_PACKAGE_MANIFEST_ENTRY, '{ not valid json')
    const blob = await toBlob(zip)

    const result = await parseKnowledgeCollectionPackageZip(blob)
    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues[0]!.code).toBe('malformed_json')
  })

  it('rejects something that is not a zip archive at all', async () => {
    const blob = new Blob(['this is plain text, not a zip file'])
    const result = await parseKnowledgeCollectionPackageZip(blob)

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.issues[0]!.message).toContain('not a valid zip archive')
  })

  it('rejects a corrupted (checksum-failing) archive', async () => {
    const manifest = fakeManifest()
    const blob = await buildCollectionPackageZip(manifest, [])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    // Flip a byte in the middle of the archive to break its CRC32 without breaking the zip's own structural framing.
    const midpoint = Math.floor(bytes.length / 2)
    bytes[midpoint] = (bytes[midpoint]! ^ 0xff) & 0xff
    const corrupted = new Blob([bytes])

    const result = await parseKnowledgeCollectionPackageZip(corrupted)
    expect(result.valid).toBe(false)
  })
})
