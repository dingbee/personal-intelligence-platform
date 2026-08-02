import { resolveCanonicalNode } from '@/modules/knowledge-intelligence/api/knowledgeNodeResolution'
import type { KnowledgeNode } from '@/shared/types/database'
import type { PackageImportContext, PackageImporter } from '@/modules/knowledge-exchange/packages/PackageImporter'
import type { KnowledgeNodePackage } from '@/modules/knowledge-exchange/knowledge-nodes/knowledgeNodePackageTypes'

/**
 * `sourceType` for every imported node — distinct from the extraction
 * pipeline's `'document'` and the deterministic matcher's `'note'`/
 * `'conversation'`, so an imported node's provenance is honestly
 * labeled as having arrived via Knowledge Exchange, not attributed to a
 * document/note/conversation that doesn't exist in the importer's
 * account. Recognized by `SOURCE_TYPE_LABEL` in `KnowledgeNodeDetailPage`
 * and `knowledgeExportMarkdown` for display.
 */
export const KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE = 'knowledge_node_import'

export interface ImportKnowledgeNodePackageResult {
  node: KnowledgeNode
  /** False means an existing node in the importer's account already had this exact (node_type, normalized title) — reused, never overwritten (see below), with this import recorded as an additional provenance entry. */
  created: boolean
}

/**
 * Reuses `resolveCanonicalNode` exactly as-is — the same dedup primitive
 * the extraction pipeline already uses, per this task's own instruction
 * ("Existing canonical node resolver may be used for deduplication") and
 * this codebase's established discipline of reusing existing primitives
 * rather than reinventing them (`docs/ux-14.5.10-knowledge-exchange-
 * expansion-discovery.md` §6.5 already identified this as requiring zero
 * new design work).
 *
 * **Never overwrites an existing node's content**, by construction, not
 * by a defensive check: `resolveCanonicalNode`'s `create`/`reuse`/
 * `refresh` decision is keyed on `(user_id, node_type, title_normalized)`
 * — since every import uses a fresh `crypto.randomUUID()` as its
 * `source_id` (there is no real originating document/note in the
 * importer's account to reference), a re-import of the same or a
 * similarly-titled package can only ever land on `create` (no existing
 * node with that title) or `reuse` (an existing node with that title —
 * its own title/description/metadata are left untouched, and only a new
 * `knowledge_node_sources` provenance row is added). The `refresh`
 * branch, which *does* update a node's content, only triggers when an
 * existing node's stored `source_type`/`source_id` exactly match the
 * new call's — a random UUID can never coincidentally match a previous
 * one, so `refresh` is structurally unreachable for imports.
 *
 * The importer becomes the owner (`userId` from context), fresh id (on
 * the `create` branch — `reuse` correctly returns the existing node's
 * own id instead, which is the intended "duplicate handling" outcome,
 * not a bug), and `workspaceId` is always the caller's explicit choice —
 * all three already guaranteed by `resolveCanonicalNode` itself, no
 * changes needed to that function.
 */
export async function importKnowledgeNodePackage(
  pkg: KnowledgeNodePackage,
  context: PackageImportContext,
): Promise<ImportKnowledgeNodePackageResult> {
  const { node, created } = await resolveCanonicalNode({
    userId: context.userId,
    workspaceId: context.workspaceId,
    nodeType: pkg.node.nodeType,
    title: pkg.node.title,
    description: pkg.node.description,
    sourceType: KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE,
    sourceId: crypto.randomUUID(),
    sourceChunkIds: [],
    generationMetadata: {
      ...(pkg.node.generationMetadata ?? {}),
      importedFrom: {
        packageVersion: pkg.version,
        sourceVersion: pkg.sourceVersion,
        exportedAt: pkg.exportedAt,
        originalCreatedAt: pkg.node.createdAt,
        originalUpdatedAt: pkg.node.updatedAt,
        importedAt: new Date().toISOString(),
      },
    },
    metadata: pkg.node.metadata,
  })

  return { node, created }
}

export const knowledgeNodePackageImporter: PackageImporter<KnowledgeNodePackage, ImportKnowledgeNodePackageResult> = {
  import: importKnowledgeNodePackage,
}
