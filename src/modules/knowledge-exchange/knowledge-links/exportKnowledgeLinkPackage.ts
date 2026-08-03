import type { KnowledgeLink, KnowledgeNode } from '@/shared/types/database'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { PackageExporter } from '@/modules/knowledge-exchange/packages/PackageExporter'
import type { KnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkPackageTypes'

/**
 * Pure — takes an already-fetched `knowledge_links` row and its two
 * already-fetched endpoint nodes (source/target, in the link's own
 * direction), builds the versioned package. No Supabase call here — the
 * export button's caller fetches all three first via
 * `fetchKnowledgeLinkForExport` (`knowledgeLinkFetch.ts`), mirroring
 * every other package type's "exporters never fetch data themselves"
 * discipline.
 */
export function exportKnowledgeLinkPackage(source: { link: KnowledgeLink; sourceNode: KnowledgeNode; targetNode: KnowledgeNode }): KnowledgeLinkPackage {
  const { link, sourceNode, targetNode } = source
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    sourceVersion: PACKAGE_SOURCE_VERSION,
    link: {
      relationshipType: link.relationship_type ?? 'related_to',
      confidence: link.confidence,
      generatedBy: link.generated_by,
      source: { nodeType: sourceNode.node_type, title: sourceNode.title, description: sourceNode.description },
      target: { nodeType: targetNode.node_type, title: targetNode.title, description: targetNode.description },
    },
  }
}

export const knowledgeLinkPackageExporter: PackageExporter<
  { link: KnowledgeLink; sourceNode: KnowledgeNode; targetNode: KnowledgeNode },
  KnowledgeLinkPackage
> = {
  export: exportKnowledgeLinkPackage,
}

/** Filesystem-safe, lowercase-hyphenated filename — same slugify pattern every prior package type's own filename helper already established. */
export function knowledgeLinkPackageFilename(sourceTitle: string, targetTitle: string): string {
  const slug = `${sourceTitle}-${targetTitle}`
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'knowledge-link-export'}.json`
}
