import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  COLLECTION_PACKAGE_MANIFEST_ENTRY,
  buildCollectionPackageZip,
  documentMemberArchiveEntry,
} from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageArchive'
import type { CollectionPackageManifest } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageTypes'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'

function fakeManifest(): CollectionPackageManifest {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: '2026-01-01T00:00:00.000Z',
    sourceVersion: PACKAGE_SOURCE_VERSION,
    collection: { name: 'Plant Biology', description: null, members: [], relationships: [] },
  }
}

describe('documentMemberArchiveEntry', () => {
  it('names nested document entries by index under document-members/', () => {
    expect(documentMemberArchiveEntry(0)).toBe('document-members/0.zip')
    expect(documentMemberArchiveEntry(3)).toBe('document-members/3.zip')
  })
})

describe('buildCollectionPackageZip', () => {
  it('produces a zip with the manifest and one entry per nested document zip', async () => {
    const documentZips = [new Blob(['zip-a']), new Blob(['zip-b'])]
    const zipBlob = await buildCollectionPackageZip(fakeManifest(), documentZips)

    const zip = await JSZip.loadAsync(zipBlob)
    const entryNames = Object.keys(zip.files)
      .filter((name) => !zip.files[name]!.dir)
      .sort()
    expect(entryNames).toEqual([COLLECTION_PACKAGE_MANIFEST_ENTRY, 'document-members/0.zip', 'document-members/1.zip'].sort())
  })

  it('the manifest entry round-trips the exact manifest as JSON', async () => {
    const manifest = fakeManifest()
    const zipBlob = await buildCollectionPackageZip(manifest, [])

    const zip = await JSZip.loadAsync(zipBlob)
    const manifestText = await zip.file(COLLECTION_PACKAGE_MANIFEST_ENTRY)!.async('text')
    expect(JSON.parse(manifestText)).toEqual(manifest)
  })

  it('each nested document zip entry round-trips its exact bytes', async () => {
    const originalBytes = new TextEncoder().encode('a real nested document zip archive')
    const zipBlob = await buildCollectionPackageZip(fakeManifest(), [new Blob([originalBytes])])

    const zip = await JSZip.loadAsync(zipBlob)
    const roundTripped = await zip.file('document-members/0.zip')!.async('uint8array')
    expect(Array.from(roundTripped)).toEqual(Array.from(originalBytes))
  })

  it('produces no document-members entries for a collection with no document members', async () => {
    const zipBlob = await buildCollectionPackageZip(fakeManifest(), [])
    const zip = await JSZip.loadAsync(zipBlob)
    expect(Object.keys(zip.files)).toEqual([COLLECTION_PACKAGE_MANIFEST_ENTRY])
  })
})
