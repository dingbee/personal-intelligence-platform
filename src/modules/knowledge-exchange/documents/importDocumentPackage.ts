import { uploadDocument } from '@/modules/library/api/documents'
import { addTagToDocument } from '@/modules/library/api/tags'
import { processDocument } from '@/modules/processing/pipeline/processDocument'
import type { DocumentFileType, DocumentRow } from '@/shared/types/database'
import type { PackageImportContext, PackageImporter } from '@/modules/knowledge-exchange/packages/PackageImporter'
import type { ValidatedDocumentPackage } from '@/modules/knowledge-exchange/documents/validateDocumentPackage'
import { DOCUMENT_PACKAGE_ORIGINAL_ENTRY } from '@/modules/knowledge-exchange/documents/documentPackageArchive'

/** Reverse of `fileTypeFromName`'s own extension map (`library/utils/fileTypes.ts`) — picks one canonical extension per file type so `uploadDocument`'s own `fileTypeFromName(file.name)` resolves back to the exact same `DocumentFileType` the manifest declared. */
const EXTENSION_BY_FILE_TYPE: Record<DocumentFileType, string> = {
  pdf: 'pdf',
  epub: 'epub',
  docx: 'docx',
  txt: 'txt',
  markdown: 'md',
  xlsx: 'xlsx',
  csv: 'csv',
  ods: 'ods',
}

/**
 * Always `uploadDocument()` (the same full pipeline a manual upload
 * already uses) — never a direct storage/table write — so import creates
 * a brand-new document by construction, mirroring Notes'/Assets'
 * always-create precedent (no canonical-identity resolver exists for
 * documents, per the UX-14.5.10.3 discovery's own §5).
 *
 * Takes the *validated* package (manifest + the CRC-verified `zip`
 * handle `parseDocumentPackageZip` already produced), not a plain
 * manifest — unlike every other package type, a document package's
 * content lives partly outside the manifest object (the original file's
 * bytes, inside the archive), so there is no self-contained "package"
 * value to import from without also carrying the zip handle forward.
 * This is a real, structural difference from Notes/Knowledge Nodes/
 * Assets, not an oversight — `ValidatedDocumentPackage` was deliberately
 * shaped this way in UX-14.5.10.3.1 for exactly this next phase to use.
 *
 * The reconstructed `File`'s name is built from the manifest's own
 * `title` (not `fileName`) plus the correct extension: `uploadDocument`
 * derives its row's `title` purely from `file.name` (stripping the
 * extension) — it has no separate title parameter the way `uploadAsset`
 * does — so this is the only way to make the imported document's title
 * match what the exporter actually had, including any in-app rename
 * that diverged from the original upload's literal filename. The
 * imported row's `file_name` will therefore differ from the original
 * document's `file_name` — an accepted, cosmetic difference; nothing
 * downstream reads `file_name` for anything beyond display.
 *
 * No chunks/embeddings/extraction metadata/summaries/flashcards are
 * created here — fire-and-forget `processDocument` (the exact,
 * unmodified call `useDocumentMutations.ts`'s own upload mutation
 * already makes after a native upload) regenerates every one of them
 * from the imported original bytes, per the UX-14.5.10.3 discovery's
 * §4/§7 findings. Progress is visible via the same `useProcessingJob`/
 * `ProcessingStatusBadge` polling UI a native upload's card already
 * uses — no new progress-reporting code needed.
 *
 * "No partial imports" (this task's own requirement) falls out of
 * reusing both functions unmodified rather than needing new rollback
 * code: `uploadDocument` already deletes the uploaded storage object if
 * its own row insert fails (existing, unmodified behavior), and
 * `processDocument`'s own try/catch already marks the document `status:
 * 'error'` (with the job's `error_message` recorded) rather than
 * leaving it stuck `processing` forever on a pipeline failure — the
 * same "Retry processing" button `DocumentDetailPage.tsx` already
 * offers a native upload applies unchanged to an imported document too.
 * The tag-attachment loop below has the same best-effort shape
 * `importNotePackage.ts` already established (no rollback if one tag
 * attachment fails partway) — an accepted, existing precedent, not a
 * new gap this phase introduces.
 */
export async function importDocumentPackage(pkg: ValidatedDocumentPackage, context: PackageImportContext): Promise<DocumentRow> {
  const { manifest, zip } = pkg
  const originalEntry = zip.file(DOCUMENT_PACKAGE_ORIGINAL_ENTRY)
  if (!originalEntry) throw new Error('This package is missing its document content.')

  const bytes = await originalEntry.async('uint8array')
  const extension = EXTENSION_BY_FILE_TYPE[manifest.document.fileType]
  const file = new File([bytes.buffer as ArrayBuffer], `${manifest.document.title}.${extension}`)

  const document = await uploadDocument({
    file,
    userId: context.userId,
    collectionId: null,
    workspaceId: context.workspaceId,
  })

  for (const tagName of manifest.document.tags) {
    await addTagToDocument({ documentId: document.id, tagName, userId: context.userId })
  }

  void processDocument(document.id, context.userId)

  return document
}

export const documentPackageImporter: PackageImporter<ValidatedDocumentPackage, DocumentRow> = {
  import: importDocumentPackage,
}
