import type { DocumentRow, Tag } from '@/shared/types/database'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { PackageExporter } from '@/modules/knowledge-exchange/packages/PackageExporter'
import type { DocumentPackageManifest } from '@/modules/knowledge-exchange/documents/documentPackageTypes'

/**
 * Pure — takes an already-fetched document row and its already-fetched
 * tags, builds the versioned manifest. No Supabase call, no zip-building
 * here (that's `buildDocumentPackageZip` in `documentPackageArchive.ts`) —
 * this exporter keeps the exact same pure/synchronous contract every
 * other package type's exporter has.
 *
 * `tags` only needs `name` — accepts both a full `Tag[]` and the
 * narrower `{id, name}[]` shape `getDocumentWithTags`/`useDocument`
 * already return (`DocumentWithTags.tags`), so `DocumentDetailPage` can
 * pass its already-loaded `document.tags` straight through.
 */
export function exportDocumentPackage(source: { document: DocumentRow; tags: Pick<Tag, 'name'>[] }): DocumentPackageManifest {
  const { document, tags } = source
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    sourceVersion: PACKAGE_SOURCE_VERSION,
    document: {
      title: document.title,
      fileName: document.file_name,
      fileType: document.file_type,
      sizeBytes: document.file_size,
      createdAt: document.created_at,
      tags: tags.map((tag) => tag.name),
    },
  }
}

export const documentPackageExporter: PackageExporter<{ document: DocumentRow; tags: Pick<Tag, 'name'>[] }, DocumentPackageManifest> = {
  export: exportDocumentPackage,
}

/** Filesystem-safe, lowercase-hyphenated filename — same slugify pattern `notePackageFilename`/`knowledgeNodePackageFilename`/`assetPackageFilename` already established, `.zip` instead of `.json` since this package type's downloadable artifact is an archive, not JSON text. */
export function documentPackageFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'document-export'}.zip`
}
