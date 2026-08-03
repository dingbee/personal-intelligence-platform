import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentRow, Tag } from '@/shared/types/database'

/**
 * Integration tests spanning the full Document Exchange lifecycle:
 * export a document to a manifest, build the real `.zip` archive,
 * simulate the file round trip (serialize to bytes, as if downloaded
 * and re-selected in a file picker), validate it, and — since
 * UX-14.5.10.3.2 — import it, exactly the same lifecycle
 * `notePackageRoundTrip.test.ts`/`knowledgeNodePackageRoundTrip.test.ts`/
 * `assetPackageRoundTrip.test.ts` already exercise for their package
 * types. `uploadDocument`/`addTagToDocument`/`processDocument` are
 * mocked here (real Supabase/embedding calls are out of scope for a
 * unit test) — `importDocumentPackage.test.ts` covers the importer's
 * own behavior in isolation in more detail; this file's job is proving
 * the whole pipe fits together end to end.
 */

const { downloadDocumentFileMock, uploadDocumentMock, addTagToDocumentMock, processDocumentMock } = vi.hoisted(() => ({
  downloadDocumentFileMock: vi.fn(),
  uploadDocumentMock: vi.fn(),
  addTagToDocumentMock: vi.fn(),
  processDocumentMock: vi.fn(),
}))

vi.mock('@/modules/processing/pipeline/downloadFile', () => ({
  downloadDocumentFile: downloadDocumentFileMock,
}))
vi.mock('@/modules/library/api/documents', () => ({
  uploadDocument: uploadDocumentMock,
}))
vi.mock('@/modules/library/api/tags', () => ({
  addTagToDocument: addTagToDocumentMock,
}))
vi.mock('@/modules/processing/pipeline/processDocument', () => ({
  processDocument: processDocumentMock,
}))

import { exportDocumentPackage } from '@/modules/knowledge-exchange/documents/exportDocumentPackage'
import { buildDocumentPackageZip, fetchDocumentOriginalFile } from '@/modules/knowledge-exchange/documents/documentPackageArchive'
import { parseDocumentPackageZip } from '@/modules/knowledge-exchange/documents/validateDocumentPackage'
import { DOCUMENT_PACKAGE_ORIGINAL_ENTRY } from '@/modules/knowledge-exchange/documents/documentPackageArchive'
import { importDocumentPackage } from '@/modules/knowledge-exchange/documents/importDocumentPackage'

function fakeSourceDocument(): DocumentRow {
  return {
    id: 'source-doc-1',
    user_id: 'exporter-1',
    workspace_id: 'exporter-workspace',
    collection_id: 'exporter-collection',
    title: 'Field Notes',
    file_name: 'field-notes.pdf',
    file_path: 'exporter-1/source-doc-1-field-notes.pdf',
    file_type: 'pdf',
    file_size: 42,
    status: 'ready',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  }
}

function fakeTags(): Tag[] {
  return [{ id: 'tag-1', user_id: 'exporter-1', name: 'research', created_at: '2026-01-01T00:00:00.000Z' }]
}

describe('export -> build archive -> validate round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a document exported by one account produces a package that validates cleanly and carries the exact original bytes', async () => {
    const originalBytes = 'the complete, unmodified contents of the original file'
    downloadDocumentFileMock.mockResolvedValueOnce(new Blob([originalBytes]))

    const sourceDocument = fakeSourceDocument()
    const manifest = exportDocumentPackage({ document: sourceDocument, tags: fakeTags() })

    const originalFile = await fetchDocumentOriginalFile(sourceDocument)
    const zipBlob = await buildDocumentPackageZip(manifest, originalFile)

    // Simulate the file round trip: the zip is what actually gets downloaded and
    // later re-selected in a file picker -- re-derive it from raw bytes exactly
    // like a freshly-read File would arrive.
    const zipBytes = await zipBlob.arrayBuffer()
    const reopenedFile = new Blob([zipBytes])

    const result = await parseDocumentPackageZip(reopenedFile)

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.package.manifest).toEqual(manifest)
    expect(result.package.manifest.document.tags).toEqual(['research'])

    const recoveredOriginal = await result.package.zip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY)!.async('text')
    expect(recoveredOriginal).toBe(originalBytes)

    // Never the exporter's own identity or internal storage reference.
    const serializedManifest = JSON.stringify(result.package.manifest)
    expect(serializedManifest).not.toContain('exporter-1')
    expect(serializedManifest).not.toContain('exporter-workspace')
    expect(serializedManifest).not.toContain('source-doc-1')
    expect(serializedManifest).not.toContain('file_path')
  })

  it('rejects a hand-tampered package (unsupported version) before any content is trusted', async () => {
    downloadDocumentFileMock.mockResolvedValueOnce(new Blob(['content']))
    const sourceDocument = fakeSourceDocument()
    const manifest = exportDocumentPackage({ document: sourceDocument, tags: fakeTags() })
    const originalFile = await fetchDocumentOriginalFile(sourceDocument)
    const zipBlob = await buildDocumentPackageZip({ ...manifest, version: 999 }, originalFile)

    const result = await parseDocumentPackageZip(zipBlob)

    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'future_version')).toBe(true)
  })

  it('rejects a truncated/corrupted download before any content is trusted', async () => {
    downloadDocumentFileMock.mockResolvedValueOnce(new Blob(['content']))
    const sourceDocument = fakeSourceDocument()
    const manifest = exportDocumentPackage({ document: sourceDocument, tags: fakeTags() })
    const originalFile = await fetchDocumentOriginalFile(sourceDocument)
    const zipBlob = await buildDocumentPackageZip(manifest, originalFile)
    const truncatedBytes = (await zipBlob.arrayBuffer()).slice(0, -20)

    const result = await parseDocumentPackageZip(new Blob([truncatedBytes]))

    expect(result.valid).toBe(false)
  })
})

describe('export -> import -> processed document (end to end)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a document exported by one account is imported by another as a brand-new document, immediately entering the existing processing pipeline', async () => {
    const originalBytes = 'the complete, unmodified contents of the original file'
    downloadDocumentFileMock.mockResolvedValueOnce(new Blob([originalBytes]))

    const sourceDocument = fakeSourceDocument()
    const manifest = exportDocumentPackage({ document: sourceDocument, tags: fakeTags() })
    const originalFile = await fetchDocumentOriginalFile(sourceDocument)
    const zipBlob = await buildDocumentPackageZip(manifest, originalFile)

    // Simulate the file round trip -- exactly what a real Import dialog does
    // with a freshly-picked File.
    const reopenedFile = new Blob([await zipBlob.arrayBuffer()])
    const parsed = await parseDocumentPackageZip(reopenedFile)
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    // Import, as a different account, into a workspace the exporter was never in.
    const importedDocument: DocumentRow = {
      id: 'new-doc-1',
      user_id: 'importer-1',
      workspace_id: 'importer-workspace',
      collection_id: null,
      title: 'Field Notes',
      file_name: 'Field Notes.pdf',
      file_path: 'importer-1/new-doc-1-Field-Notes.pdf',
      file_type: 'pdf',
      file_size: originalBytes.length,
      status: 'uploaded',
      created_at: '2026-03-01T00:00:00.000Z',
      updated_at: '2026-03-01T00:00:00.000Z',
    }
    uploadDocumentMock.mockResolvedValueOnce(importedDocument)

    const result = await importDocumentPackage(parsed.package, { userId: 'importer-1', workspaceId: 'importer-workspace' })

    expect(result).toBe(importedDocument)

    // Ownership: importer becomes owner, explicit destination workspace, no collection carried over.
    const uploadCall = uploadDocumentMock.mock.calls[0]![0] as {
      file: File
      userId: string
      collectionId: string | null
      workspaceId: string | null
    }
    expect(uploadCall.userId).toBe('importer-1')
    expect(uploadCall.workspaceId).toBe('importer-workspace')
    expect(uploadCall.collectionId).toBeNull()

    // Fresh identity: uploadDocument (not the package) is the only source of a
    // storage path/id -- the package never supplies one to begin with.
    expect(uploadCall).not.toHaveProperty('filePath')
    expect(uploadCall).not.toHaveProperty('id')

    // The reconstructed File carries the exact original bytes -- nothing lost,
    // nothing substituted, across export -> zip -> validate -> import.
    expect(await uploadCall.file.text()).toBe(originalBytes)

    // Tags re-resolved by name in the importer's own account.
    expect(addTagToDocumentMock).toHaveBeenCalledWith({ documentId: 'new-doc-1', tagName: 'research', userId: 'importer-1' })

    // Immediately enters the existing processing pipeline -- no chunks/embeddings/
    // extraction metadata/summaries/flashcards are created by the importer itself;
    // this fire-and-forget call is the only thing that regenerates them, exactly
    // per this task's own processing requirement.
    expect(processDocumentMock).toHaveBeenCalledWith('new-doc-1', 'importer-1')

    // Never the exporter's identity.
    expect(uploadDocumentMock).not.toHaveBeenCalledWith(expect.objectContaining({ userId: 'exporter-1' }))
    expect(uploadDocumentMock).not.toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'exporter-workspace' }))
  })

  it('a CRC-corrupted package is rejected before upload/processing is ever attempted', async () => {
    const marker = 'ORIGINAL-CONTENT-MARKER-0123456789-END-TO-END'
    downloadDocumentFileMock.mockResolvedValueOnce(new Blob([marker]))
    const sourceDocument = fakeSourceDocument()
    const manifest = exportDocumentPackage({ document: sourceDocument, tags: fakeTags() })
    const originalFile = await fetchDocumentOriginalFile(sourceDocument)
    const zipBlob = await buildDocumentPackageZip(manifest, originalFile)

    const zipBytes = new Uint8Array(await zipBlob.arrayBuffer())
    const markerBytes = new TextEncoder().encode(marker)
    let markerOffset = -1
    outer: for (let i = 0; i <= zipBytes.length - markerBytes.length; i++) {
      for (let j = 0; j < markerBytes.length; j++) {
        if (zipBytes[i + j] !== markerBytes[j]) continue outer
      }
      markerOffset = i
      break
    }
    expect(markerOffset).toBeGreaterThanOrEqual(0)

    const corruptedBytes = zipBytes.slice()
    corruptedBytes[markerOffset] = (corruptedBytes[markerOffset]! ^ 0xff) & 0xff

    const parsed = await parseDocumentPackageZip(new Blob([corruptedBytes]))

    expect(parsed.valid).toBe(false)
    if (!parsed.valid) expect(parsed.issues[0]!.message).toMatch(/corrupted/i)
    expect(uploadDocumentMock).not.toHaveBeenCalled()
    expect(processDocumentMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized package before upload/processing is ever attempted', async () => {
    // Reuses the same real zip-bomb construction validateDocumentPackage.test.ts
    // proves in isolation -- here asserted as part of the full import pipeline:
    // a bomb must never reach uploadDocument/processDocument.
    const { MAX_UPLOAD_BYTES } = await import('@/modules/library/utils/fileTypes')
    const JSZip = (await import('jszip')).default
    const bombSize = MAX_UPLOAD_BYTES + 1024
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(exportDocumentPackage({ document: fakeSourceDocument(), tags: fakeTags() })))
    zip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY, new Uint8Array(bombSize), { compression: 'DEFLATE', compressionOptions: { level: 9 } })
    const bombBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })

    const parsed = await parseDocumentPackageZip(bombBlob)

    expect(parsed.valid).toBe(false)
    if (!parsed.valid) expect(parsed.issues[0]!.message).toMatch(/too large/i)
    expect(uploadDocumentMock).not.toHaveBeenCalled()
    expect(processDocumentMock).not.toHaveBeenCalled()
  }, 30_000)
})
