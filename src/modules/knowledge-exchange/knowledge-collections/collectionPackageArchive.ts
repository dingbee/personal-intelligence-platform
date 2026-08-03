import JSZip from 'jszip'
import type { CollectionPackageManifest } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageTypes'

/**
 * UX-14.5.10.6 — per the discovery's §5, a Collection package is a `.zip`
 * (via `jszip`, already a direct dependency — no new library), not plain
 * JSON, specifically because it needs to embed Document members without a
 * second layer of base64 inflation. `manifest.json` carries the whole
 * `CollectionPackageManifest` (every `knowledge_node`/`note`/`asset`
 * member's payload embedded directly as JSON — no size concern, these are
 * all small — plus each `document` member's manifest-only half); each
 * `document` member's own original file bytes travel as a separate,
 * already-built nested `.zip` entry, one per document member.
 */
export const COLLECTION_PACKAGE_MANIFEST_ENTRY = 'manifest.json'
export const COLLECTION_PACKAGE_DOCUMENT_MEMBERS_DIR = 'document-members/'

/** The exact nested-entry path a document member's `archiveEntry` field points at — kept as one function so export and import always agree on the naming scheme. */
export function documentMemberArchiveEntry(index: number): string {
  return `${COLLECTION_PACKAGE_DOCUMENT_MEMBERS_DIR}${index}.zip`
}

/**
 * The one place this package type does real archive-building work — mirrors
 * `buildDocumentPackageZip`'s exact role for its own package type. Each
 * `documentMemberZips[i]` is expected to already be a complete, valid
 * Document package archive (built by the unmodified `buildDocumentPackageZip`)
 * — this function does no per-type serialization of its own, only
 * orchestration, per the discovery's §4.
 *
 * Stored, never compressed — same "predictable size" reasoning
 * `buildDocumentPackageZip`'s own STORE choice already established (the
 * nested document zips are themselves already-compressed-or-incompressible
 * archives; the small `manifest.json` text costs nothing either way).
 */
export async function buildCollectionPackageZip(manifest: CollectionPackageManifest, documentMemberZips: Blob[]): Promise<Blob> {
  const zip = new JSZip()
  zip.file(COLLECTION_PACKAGE_MANIFEST_ENTRY, JSON.stringify(manifest, null, 2))
  documentMemberZips.forEach((memberZip, index) => {
    zip.file(documentMemberArchiveEntry(index), memberZip)
  })
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}
