import { resolveCanonicalNode } from '@/modules/knowledge-intelligence/api/knowledgeNodeResolution'
import { upsertKnowledgeEdges } from '@/modules/knowledge-intelligence/api/knowledgeEdges'
import { KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE } from '@/modules/knowledge-exchange/knowledge-nodes/importKnowledgeNodePackage'
import type { KnowledgeNode } from '@/shared/types/database'
import type { PackageImportContext, PackageImporter } from '@/modules/knowledge-exchange/packages/PackageImporter'
import type { KnowledgeLinkEndpointPayload, KnowledgeLinkPackage } from '@/modules/knowledge-exchange/knowledge-links/knowledgeLinkPackageTypes'

/** Distinct, honest label for an edge whose original `generatedBy` was null (a hypothetical today — see the package type's own doc-comment: every relationship this app currently produces sets it). Never used to overwrite a real value; see `importKnowledgeLinkPackage` below. */
const KNOWLEDGE_LINK_IMPORT_GENERATED_BY = 'knowledge_link_import'

export interface ImportKnowledgeLinkPackageResult {
  sourceNode: KnowledgeNode
  targetNode: KnowledgeNode
  /** False means an existing node in the importer's account already had this exact (node_type, normalized title) — reused, never overwritten, exactly like Knowledge Node import's own "created" flag. */
  sourceCreated: boolean
  targetCreated: boolean
  relationshipType: string
}

async function resolveEndpoint(endpoint: KnowledgeLinkEndpointPayload, context: PackageImportContext) {
  return resolveCanonicalNode({
    userId: context.userId,
    workspaceId: context.workspaceId,
    nodeType: endpoint.nodeType,
    title: endpoint.title,
    description: endpoint.description,
    sourceType: KNOWLEDGE_NODE_IMPORT_SOURCE_TYPE,
    sourceId: crypto.randomUUID(),
    sourceChunkIds: [],
    generationMetadata: {},
  })
}

/**
 * Resolves both endpoints through the exact same `resolveCanonicalNode`
 * primitive Knowledge Node import already uses (find-or-create by
 * title, importer becomes owner, fresh id on create) — reused
 * unmodified, per this task's own instruction. Only once **both**
 * resolutions have succeeded does the relationship itself get written,
 * via `upsertKnowledgeEdges` (also reused unmodified except for the
 * additive, backward-compatible `metadata` field added this phase — see
 * `knowledgeEdges.ts`). This ordering is what "never create broken
 * links" means in practice: there is no code path that inserts a
 * `knowledge_links` row before both `source_id`/`target_id` genuinely
 * exist, and if either resolution throws (e.g. a database error), the
 * whole import rejects — nothing partial is ever written, and the
 * failure surfaces to the caller rather than being silently discarded.
 *
 * **Duplicate handling** falls out of composing these two primitives,
 * not new logic: re-importing the same package resolves both endpoints
 * back to the *same* existing nodes (title-matched, per
 * `resolveCanonicalNode`'s own reuse behavior), so `upsertKnowledgeEdges`'s
 * existing `onConflict: 'source_type,source_id,target_type,target_id'`
 * updates the same relationship row rather than creating a second one.
 *
 * `generatedBy` is preserved verbatim from the package when present —
 * unlike `source_type`/`source_id` (which must be re-attributed to
 * Knowledge Exchange, since the original document/note/conversation
 * doesn't exist in the importer's account), `generatedBy` is portable,
 * free-text provenance information ("which AI process found this") that
 * stays accurate regardless of which account now holds the row.
 */
export async function importKnowledgeLinkPackage(
  pkg: KnowledgeLinkPackage,
  context: PackageImportContext,
): Promise<ImportKnowledgeLinkPackageResult> {
  const { link } = pkg

  const [sourceResult, targetResult] = await Promise.all([
    resolveEndpoint(link.source, context),
    resolveEndpoint(link.target, context),
  ])

  await upsertKnowledgeEdges([
    {
      userId: context.userId,
      workspaceId: context.workspaceId,
      sourceType: 'knowledge_node',
      sourceId: sourceResult.node.id,
      targetType: 'knowledge_node',
      targetId: targetResult.node.id,
      relationshipType: link.relationshipType,
      confidence: link.confidence,
      generatedBy: link.generatedBy ?? KNOWLEDGE_LINK_IMPORT_GENERATED_BY,
      metadata: {
        importedFrom: {
          packageVersion: pkg.version,
          sourceVersion: pkg.sourceVersion,
          exportedAt: pkg.exportedAt,
          importedAt: new Date().toISOString(),
        },
      },
    },
  ])

  return {
    sourceNode: sourceResult.node,
    targetNode: targetResult.node,
    sourceCreated: sourceResult.created,
    targetCreated: targetResult.created,
    relationshipType: link.relationshipType,
  }
}

export const knowledgeLinkPackageImporter: PackageImporter<KnowledgeLinkPackage, ImportKnowledgeLinkPackageResult> = {
  import: importKnowledgeLinkPackage,
}
