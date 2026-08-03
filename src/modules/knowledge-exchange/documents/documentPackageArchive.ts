import JSZip from 'jszip'
import { downloadDocumentFile } from '@/modules/processing/pipeline/downloadFile'
import type { DocumentRow } from '@/shared/types/database'
import type { DocumentPackageManifest } from '@/modules/knowledge-exchange/documents/documentPackageTypes'

/**
 * UX-14.5.10.3.1 — the two entries every Document package `.zip` contains.
 * Kept as named constants shared between the exporter, the validator, and
 * (in a later phase) the importer, rather than repeating the literal
 * strings.
 */
export const DOCUMENT_PACKAGE_MANIFEST_ENTRY = 'manifest.json'
export const DOCUMENT_PACKAGE_ORIGINAL_ENTRY = 'original'

/**
 * The one place this package type does real archive-building work — kept
 * separate from `exportDocumentPackage()` for the same reason
 * `assetFileTransfer.ts` was split out from `exportAssetPackage()` in
 * UX-14.5.10.2: `PackageExporter.export()` stays a pure, synchronous
 * function (the manifest object), while the actual async I/O — here,
 * building a zip archive; for Assets, fetching+base64-encoding file bytes
 * — lives in dedicated glue the UI/hook layer calls before triggering a
 * download.
 *
 * `original` is stored, never compressed: most supported document formats
 * (docx/epub/xlsx) are themselves zip containers already close to
 * incompressible, so DEFLATE would spend CPU for no size benefit; for the
 * formats that would compress well (pdf/txt/markdown/csv), a uniform
 * STORE choice keeps this phase's archive size trivially predictable —
 * always within a small, fixed overhead of the original file's own size
 * — which is exactly the property `validateDocumentPackage.ts`'s
 * pre-decompression size gate (the zip-bomb defense) depends on for a
 * legitimately-produced package.
 */
export async function buildDocumentPackageZip(manifest: DocumentPackageManifest, originalFile: Blob): Promise<Blob> {
  const zip = new JSZip()
  zip.file(DOCUMENT_PACKAGE_MANIFEST_ENTRY, JSON.stringify(manifest, null, 2))
  zip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY, originalFile)
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

/**
 * Fetches the original file for export. The exporting account always
 * already owns this file (the same private, per-user-folder-RLS bucket
 * shape Assets' bucket has), so this is a plain owner-scoped storage
 * download — no signed URL needed, unlike Assets, whose bucket is read
 * for inline *display* (an `<img>` `src`), not just export.
 */
export async function fetchDocumentOriginalFile(document: Pick<DocumentRow, 'file_path'>): Promise<Blob> {
  return downloadDocumentFile(document.file_path)
}
