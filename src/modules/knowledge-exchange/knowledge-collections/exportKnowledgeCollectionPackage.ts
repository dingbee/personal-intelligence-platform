import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { PackageExporter } from '@/modules/knowledge-exchange/packages/PackageExporter'
import type { CollectionMemberEntry, CollectionPackageManifest } from '@/modules/knowledge-exchange/knowledge-collections/collectionPackageTypes'
import type { KnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkPackageTypes'

export interface CollectionExportSource {
  collection: { name: string; description: string | null }
  /** Already-built member entries — each one produced by calling that type's own existing, unmodified `export<Type>Package` function (or, for `document`, that plus an `archiveEntry` path — see `buildKnowledgeCollectionExportPackage.ts`). This exporter does no per-type serialization of its own, only assembly, per the discovery's §4. */
  members: CollectionMemberEntry[]
  /** Already-built via the unmodified `exportKnowledgeLinkPackage`, one per edge between two of this collection's own `knowledge_node` members (§2.6). */
  relationships: KnowledgeLinkPackage[]
}

/**
 * Pure — takes already-fetched, already-per-type-exported data and builds
 * the versioned manifest. No Supabase call, no zip-building here (that's
 * `collectionPackageArchive.ts`'s `buildCollectionPackageZip` plus the
 * async orchestration in `buildKnowledgeCollectionExportPackage.ts`) — this
 * exporter keeps the exact same pure/synchronous contract every other
 * package type's exporter has, per `PackageExporter`.
 */
export function exportKnowledgeCollectionPackage(source: CollectionExportSource): CollectionPackageManifest {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    sourceVersion: PACKAGE_SOURCE_VERSION,
    collection: {
      name: source.collection.name,
      description: source.collection.description,
      members: source.members,
      relationships: source.relationships,
    },
  }
}

export const knowledgeCollectionPackageExporter: PackageExporter<CollectionExportSource, CollectionPackageManifest> = {
  export: exportKnowledgeCollectionPackage,
}

/** Filesystem-safe, lowercase-hyphenated filename — same slugify pattern every prior package type's own filename helper already established, `.zip` since this package type's downloadable artifact is an archive, not JSON text (matching `documentPackageFilename`). */
export function knowledgeCollectionPackageFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'collection-export'}.zip`
}
