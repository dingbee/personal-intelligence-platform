import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentRow, Tag } from '@/shared/types/database'

/**
 * UX-14.5.10.3.1 integration test: export a document to a manifest, build
 * the real `.zip` archive, simulate the file round trip (serialize to
 * bytes, as if downloaded and re-selected in a file picker), then
 * validate it — the same lifecycle `notePackageRoundTrip.test.ts`/
 * `knowledgeNodePackageRoundTrip.test.ts`/`assetPackageRoundTrip.test.ts`
 * already exercise for their package types, scoped to what this phase
 * actually builds: export + archive + validate. No import step exists
 * yet (UX-14.5.10.3.2, deliberately not built this phase).
 */

const { downloadDocumentFileMock } = vi.hoisted(() => ({ downloadDocumentFileMock: vi.fn() }))

vi.mock('@/modules/processing/pipeline/downloadFile', () => ({
  downloadDocumentFile: downloadDocumentFileMock,
}))

import { exportDocumentPackage } from '@/modules/knowledge-exchange/documents/exportDocumentPackage'
import { buildDocumentPackageZip, fetchDocumentOriginalFile } from '@/modules/knowledge-exchange/documents/documentPackageArchive'
import { parseDocumentPackageZip } from '@/modules/knowledge-exchange/documents/validateDocumentPackage'
import { DOCUMENT_PACKAGE_ORIGINAL_ENTRY } from '@/modules/knowledge-exchange/documents/documentPackageArchive'

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
