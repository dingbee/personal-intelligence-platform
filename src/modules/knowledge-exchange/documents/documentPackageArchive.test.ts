import JSZip from 'jszip'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentPackageManifest } from '@/modules/knowledge-exchange/documents/documentPackageTypes'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

const { downloadDocumentFileMock } = vi.hoisted(() => ({ downloadDocumentFileMock: vi.fn() }))

vi.mock('@/modules/processing/pipeline/downloadFile', () => ({
  downloadDocumentFile: downloadDocumentFileMock,
}))

import {
  DOCUMENT_PACKAGE_MANIFEST_ENTRY,
  DOCUMENT_PACKAGE_ORIGINAL_ENTRY,
  buildDocumentPackageZip,
  fetchDocumentOriginalFile,
} from '@/modules/knowledge-exchange/documents/documentPackageArchive'

function fakeManifest(overrides: Partial<DocumentPackageManifest['document']> = {}): DocumentPackageManifest {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-05T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    document: {
      title: 'Field Notes',
      fileName: 'field-notes.pdf',
      fileType: 'pdf',
      sizeBytes: 12,
      createdAt: '2026-01-01T00:00:00.000Z',
      tags: ['research'],
      ...overrides,
    },
  }
}

describe('buildDocumentPackageZip', () => {
  it('produces a zip with exactly the manifest and original entries', async () => {
    const originalBytes = new TextEncoder().encode('hello world!')
    const zipBlob = await buildDocumentPackageZip(fakeManifest(), new Blob([originalBytes]))

    const zip = await JSZip.loadAsync(zipBlob)
    const entryNames = Object.keys(zip.files)
    expect(entryNames.sort()).toEqual([DOCUMENT_PACKAGE_MANIFEST_ENTRY, DOCUMENT_PACKAGE_ORIGINAL_ENTRY].sort())
  })

  it('the manifest entry round-trips the exact manifest as JSON', async () => {
    const manifest = fakeManifest({ title: 'A Different Title' })
    const zipBlob = await buildDocumentPackageZip(manifest, new Blob(['x']))

    const zip = await JSZip.loadAsync(zipBlob)
    const manifestText = await zip.file(DOCUMENT_PACKAGE_MANIFEST_ENTRY)!.async('text')
    expect(JSON.parse(manifestText)).toEqual(manifest)
  })

  it('the original entry round-trips the exact original bytes', async () => {
    const originalBytes = new TextEncoder().encode('the quick brown fox jumps over the lazy dog')
    const zipBlob = await buildDocumentPackageZip(fakeManifest(), new Blob([originalBytes]))

    const zip = await JSZip.loadAsync(zipBlob)
    const roundTripped = await zip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY)!.async('uint8array')
    expect(Array.from(roundTripped)).toEqual(Array.from(originalBytes))
  })

  it('stores the original entry uncompressed (STORE), never deflated', async () => {
    // `.options.compression` doesn't survive a generate->loadAsync round trip
    // (jszip's own `load.js` doesn't repopulate it), so this checks the
    // property black-box instead: STORE never shrinks below the content's own
    // size, while DEFLATE on this highly repetitive content would shrink it
    // dramatically -- exactly the "predictable size" property
    // `validateDocumentPackage.ts`'s size gate depends on.
    const highlyCompressible = 'A'.repeat(100_000)
    const zipBlob = await buildDocumentPackageZip(fakeManifest(), new Blob([highlyCompressible]))

    expect(zipBlob.size).toBeGreaterThanOrEqual(highlyCompressible.length)
  })
})

describe('fetchDocumentOriginalFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('downloads the document by its own file_path, no signed URL involved', async () => {
    const fakeBlob = new Blob(['content'])
    downloadDocumentFileMock.mockResolvedValueOnce(fakeBlob)

    const result = await fetchDocumentOriginalFile({ file_path: 'user-1/doc-1/original.pdf' })

    expect(downloadDocumentFileMock).toHaveBeenCalledWith('user-1/doc-1/original.pdf')
    expect(result).toBe(fakeBlob)
  })
})
