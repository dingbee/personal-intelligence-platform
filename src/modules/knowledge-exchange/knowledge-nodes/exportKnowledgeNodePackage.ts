import type { KnowledgeNode } from '@/shared/types/database'
import { CURRENT_PACKAGE_VERSION, PACKAGE_SOURCE_VERSION } from '@/modules/knowledge-exchange/packages/PackageVersion'
import type { PackageExporter } from '@/modules/knowledge-exchange/packages/PackageExporter'
import type { KnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/knowledgeNodePackageTypes'

/** Pure — takes an already-fetched node, builds the versioned package. No Supabase call here, matching `exportNotePackage`'s exact shape (the node is already loaded on `KnowledgeNodeDetailPage`). */
export function exportKnowledgeNodePackage(node: KnowledgeNode): KnowledgeNodePackage {
  return {
    version: CURRENT_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    sourceVersion: PACKAGE_SOURCE_VERSION,
    node: {
      nodeType: node.node_type,
      title: node.title,
      description: node.description,
      metadata: node.metadata,
      generationMetadata: node.generation_metadata,
      createdAt: node.created_at,
      updatedAt: node.updated_at,
    },
  }
}

export const knowledgeNodePackageExporter: PackageExporter<KnowledgeNode, KnowledgeNodePackage> = {
  export: exportKnowledgeNodePackage,
}

/** Filesystem-safe, lowercase-hyphenated filename — same pattern `notePackageFilename`/`knowledgeExportFilename` already established. */
export function knowledgeNodePackageFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'knowledge-node-export'}.json`
}
