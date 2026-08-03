import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { parseDocumentPackageZip } from '@/modules/knowledge-exchange/documents/validateDocumentPackage'
import { buildDocumentPackageZip, DOCUMENT_PACKAGE_MANIFEST_ENTRY, DOCUMENT_PACKAGE_ORIGINAL_ENTRY } from '@/modules/knowledge-exchange/documents/documentPackageArchive'
import type { DocumentPackageManifest } from '@/modules/knowledge-exchange/documents/documentPackageTypes'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import { MAX_UPLOAD_BYTES } from '@/modules/library/utils/fileTypes'

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

function indexOfSubarray(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

describe('parseDocumentPackageZip', () => {
  it('accepts a well-formed package built by buildDocumentPackageZip', async () => {
    const manifest = fakeManifest()
    const zipBlob = await buildDocumentPackageZip(manifest, new Blob(['hello world']))

    const result = await parseDocumentPackageZip(zipBlob)

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.package.manifest).toEqual(manifest)
      const originalText = await result.package.zip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY)!.async('text')
      expect(originalText).toBe('hello world')
    }
  })

  it('rejects a non-zip blob outright', async () => {
    const result = await parseDocumentPackageZip(new Blob(['this is definitely not a zip file']))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.code).toBe('invalid_schema')
  })

  it('rejects a zip missing the original entry', async () => {
    const zip = new JSZip()
    zip.file(DOCUMENT_PACKAGE_MANIFEST_ENTRY, JSON.stringify(fakeManifest()))
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    const result = await parseDocumentPackageZip(zipBlob)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.message).toContain('unexpected contents')
  })

  it('rejects a zip missing the manifest entry', async () => {
    const zip = new JSZip()
    zip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY, 'raw bytes')
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    const result = await parseDocumentPackageZip(zipBlob)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.message).toContain('unexpected contents')
  })

  it('rejects a zip with an extra, unexpected entry', async () => {
    const zip = new JSZip()
    zip.file(DOCUMENT_PACKAGE_MANIFEST_ENTRY, JSON.stringify(fakeManifest()))
    zip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY, 'raw bytes')
    zip.file('sneaky-extra-file.txt', 'not supposed to be here')
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    const result = await parseDocumentPackageZip(zipBlob)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.message).toContain('unexpected contents')
  })

  it('rejects malformed JSON inside a structurally valid zip', async () => {
    const zip = new JSZip()
    zip.file(DOCUMENT_PACKAGE_MANIFEST_ENTRY, '{ this is not valid json')
    zip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY, 'raw bytes')
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    const result = await parseDocumentPackageZip(zipBlob)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.code).toBe('malformed_json')
  })

  it('rejects a manifest missing required fields', async () => {
    const zipBlob = await buildDocumentPackageZip({ ...fakeManifest(), document: { ...fakeManifest().document, title: '' } }, new Blob(['x']))

    const result = await parseDocumentPackageZip(zipBlob)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.message.includes('title'))).toBe(true)
  })

  it('rejects an unsupported fileType', async () => {
    const zipBlob = await buildDocumentPackageZip(
      { ...fakeManifest(), document: { ...fakeManifest().document, fileType: 'exe' as never } },
      new Blob(['x']),
    )

    const result = await parseDocumentPackageZip(zipBlob)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'invalid_schema')).toBe(true)
  })

  it('rejects a future package version', async () => {
    const zipBlob = await buildDocumentPackageZip({ ...fakeManifest(), version: CURRENT_PACKAGE_VERSION + 1 }, new Blob(['x']))

    const result = await parseDocumentPackageZip(zipBlob)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'future_version')).toBe(true)
  })

  it('rejects an unsupported (non-future, unknown) version', async () => {
    const zipBlob = await buildDocumentPackageZip({ ...fakeManifest(), version: 0 }, new Blob(['x']))

    const result = await parseDocumentPackageZip(zipBlob)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues.some((i) => i.code === 'unsupported_version')).toBe(true)
  })

  it('rejects a package whose outer archive size alone already exceeds the cap, without parsing it as a zip at all', async () => {
    // A raw oversized blob, not even a real zip -- proves the cheapest, first-line
    // size gate runs before any zip parsing is attempted.
    const oversized = new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 512 * 1024)])

    const result = await parseDocumentPackageZip(oversized)

    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.message).toMatch(/too large/i)
  })

  it(
    'rejects a package whose original entry declares a decompressed size over the cap, without fully decompressing it (zip-bomb defense)',
    async () => {
      // A real DEFLATE-compressed entry: a large, highly repetitive buffer compresses
      // down to a tiny archive, but its central-directory-declared uncompressed size
      // genuinely exceeds MAX_UPLOAD_BYTES -- the honest "small package, huge declared
      // content" shape a zip bomb exploits. The pre-decompression size gate must reject
      // this using only the declared size, not by attempting to fully inflate it.
      const bombSize = MAX_UPLOAD_BYTES + 1024
      const repetitive = new Uint8Array(bombSize) // all zero bytes -- compresses to almost nothing under DEFLATE

      const zip = new JSZip()
      zip.file(DOCUMENT_PACKAGE_MANIFEST_ENTRY, JSON.stringify(fakeManifest({ sizeBytes: bombSize })))
      zip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY, repetitive, { compression: 'DEFLATE', compressionOptions: { level: 9 } })
      const bombBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })

      // The bomb's own outer archive size should be tiny (proves DEFLATE actually compressed it) --
      // otherwise this test wouldn't be exercising the declared-size gate specifically.
      expect(bombBlob.size).toBeLessThan(1024 * 1024)

      const result = await parseDocumentPackageZip(bombBlob)

      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.issues[0]!.message).toMatch(/too large/i)
    },
    30_000,
  )

  it('rejects a package whose original entry content was corrupted after export (CRC32 mismatch)', async () => {
    const marker = 'ORIGINAL-CONTENT-MARKER-0123456789-DO-NOT-COLLIDE'
    const zipBlob = await buildDocumentPackageZip(fakeManifest(), new Blob([marker]))
    const zipBytes = new Uint8Array(await zipBlob.arrayBuffer())
    const markerBytes = new TextEncoder().encode(marker)

    const markerOffset = indexOfSubarray(zipBytes, markerBytes)
    expect(markerOffset).toBeGreaterThanOrEqual(0)

    const corruptedBytes = zipBytes.slice()
    corruptedBytes[markerOffset] = (corruptedBytes[markerOffset]! ^ 0xff) & 0xff
    const corruptedBlob = new Blob([corruptedBytes])

    const result = await parseDocumentPackageZip(corruptedBlob)

    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.issues[0]!.message).toMatch(/corrupted/i)
  })
})
