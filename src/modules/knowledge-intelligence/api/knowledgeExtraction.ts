import type { DocumentChunk, KnowledgeNode } from '@/shared/types/database'
import { listDocumentChunks } from '@/modules/processing/api/chunks'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { upsertKnowledgeNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { upsertKnowledgeEdges } from '@/modules/knowledge-intelligence/api/knowledgeEdges'
import { buildEdgeInputsFromRelationships } from '@/modules/knowledge-intelligence/api/knowledgeRelationships'
import {
  parseConceptsResponse,
  parseEntitiesResponse,
  parseRelationshipsResponse,
} from '@/modules/knowledge-intelligence/utils/parseKnowledgeExtractionResponse'

/** Bounds how much document content goes into a single extraction prompt — same truncation-consciousness as the chunker's MAX_CHUNK_CHARS, just applied at the prompt-assembly end instead of the chunking end. Exported for Document Intelligence v1's runDocumentIntelligence, which needs the identical bounded-content shape for its own document-scoped capability call. */
const MAX_CONTENT_CHARS = 12000

export function boundContent(chunks: DocumentChunk[]): { content: string; chunkIds: string[] } {
  let content = ''
  const chunkIds: string[] = []
  for (const chunk of chunks) {
    if (chunkIds.length > 0 && content.length + chunk.content.length > MAX_CONTENT_CHARS) break
    content += (content ? '\n\n' : '') + chunk.content
    chunkIds.push(chunk.id)
  }
  return { content, chunkIds }
}

export interface RunKnowledgeExtractionParams {
  documentId: string
  userId: string
  workspaceId: string | null
  /** Ordered candidates from useProviderChain. Only the first call (extract-concepts) uses this for fallback — every later call in this same run is pinned to whichever provider that first call actually used, so concepts/entities/relationships are never split across different models mid-workflow (see the Phase 8C audit's capability-routing conclusion). */
  chain: string[]
}

export interface KnowledgeExtractionResult {
  concepts: KnowledgeNode[]
  entities: KnowledgeNode[]
  edgesCreated: number
}

export interface RunKnowledgeExtractionFromContentParams {
  content: string
  /** Polymorphic — knowledge_nodes.source_type/source_id, same convention knowledge_links already uses (enforced in application code, not the database, per 0012_knowledge_intelligence_foundation.sql). 'document' for the existing pipeline; 'asset' for Multimodal Intelligence v1's image analysis. */
  sourceType: string
  sourceId: string
  /** Empty when the source has no document_chunks of its own (e.g. an asset) — knowledge_nodes.source_chunk_ids is just jsonb, no non-empty constraint. */
  sourceChunkIds: string[]
  userId: string
  workspaceId: string | null
  /** Ordered candidates from useProviderChain. See RunKnowledgeExtractionParams.chain. */
  chain: string[]
}

/**
 * The actual extract-concepts/entities -> detect-relationships -> persist
 * chain, generalized over its source (Multimodal Intelligence v1 — this
 * used to be runKnowledgeExtraction's own body, hardcoded to
 * sourceType: 'document'/sourceId: documentId; runKnowledgeExtraction is
 * now a thin document-chunk-fetching wrapper around this). Every step
 * reuses existing infrastructure: runCapability for execution (which
 * itself logs to ai_requests), upsertKnowledgeNodes/upsertKnowledgeEdges
 * for persistence (upsert, so re-running is a refresh, never a duplicate
 * or a delete). No new AI provider or embedding call — see the Phase 7A
 * audit for why source_chunk_ids substitutes for a per-node embedding.
 */
export async function runKnowledgeExtractionFromContent(params: RunKnowledgeExtractionFromContentParams): Promise<KnowledgeExtractionResult> {
  const { content, sourceType, sourceId, sourceChunkIds: chunkIds, userId, workspaceId, chain } = params
  const generatedAt = new Date().toISOString()

  // The first call is the only one that ever falls back — it establishes
  // `providerId` for the rest of this run. extract-entities therefore can't
  // run in parallel with it anymore (it needs to know the pinned provider
  // first), a deliberate latency trade for never mixing providers within
  // one extraction.
  const { result: conceptsRun, providerId } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'extract-concepts',
      variables: { content },
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )
  const entitiesRun = await runCapability({ capabilityId: 'extract-entities', variables: { content }, userId, workspaceId, providerId })

  const conceptItems = parseConceptsResponse(conceptsRun.content)
  const entityItems = parseEntitiesResponse(entitiesRun.content)

  const [concepts, entities] = await Promise.all([
    upsertKnowledgeNodes(
      conceptItems.map((item) => ({
        userId,
        workspaceId,
        nodeType: 'concept',
        title: item.title,
        description: item.description,
        sourceType,
        sourceId,
        sourceChunkIds: chunkIds,
        generationMetadata: {
          capability: 'extract-concepts',
          provider: providerId,
          model: conceptsRun.model,
          generated_at: generatedAt,
        },
      })),
    ),
    upsertKnowledgeNodes(
      entityItems.map((item) => ({
        userId,
        workspaceId,
        nodeType: 'entity',
        title: item.title,
        description: item.description,
        sourceType,
        sourceId,
        sourceChunkIds: chunkIds,
        generationMetadata: {
          capability: 'extract-entities',
          provider: providerId,
          model: entitiesRun.model,
          generated_at: generatedAt,
        },
        metadata: item.entityType ? { entityType: item.entityType } : null,
      })),
    ),
  ])

  const allNodes = [...concepts, ...entities]
  if (allNodes.length < 2) {
    return { concepts, entities, edgesCreated: 0 }
  }

  const relationshipsRun = await runCapability({
    capabilityId: 'detect-relationships',
    variables: {
      content,
      nodes: JSON.stringify(allNodes.map((node) => ({ title: node.title, type: node.node_type }))),
    },
    userId,
    workspaceId,
    providerId,
  })
  const relationshipItems = parseRelationshipsResponse(relationshipsRun.content)

  const edges = buildEdgeInputsFromRelationships(allNodes, relationshipItems, {
    userId,
    workspaceId,
    generatedBy: 'ai:detect-relationships',
  })

  await upsertKnowledgeEdges(edges)

  return { concepts, entities, edgesCreated: edges.length }
}

/**
 * The original document-scoped entry point, now a thin wrapper: fetch the
 * document's chunks, bound them into one prompt-sized string, and delegate
 * to runKnowledgeExtractionFromContent with sourceType: 'document'. Every
 * existing call site (Knowledge Extraction Controls on Document Detail,
 * etc.) is unaffected.
 */
export async function runKnowledgeExtraction(params: RunKnowledgeExtractionParams): Promise<KnowledgeExtractionResult> {
  const { documentId, userId, workspaceId, chain } = params

  const chunks = await listDocumentChunks(documentId)
  if (chunks.length === 0) {
    throw new Error('This document has no processed content to extract from yet.')
  }
  const { content, chunkIds } = boundContent(chunks)

  return runKnowledgeExtractionFromContent({
    content,
    sourceType: 'document',
    sourceId: documentId,
    sourceChunkIds: chunkIds,
    userId,
    workspaceId,
    chain,
  })
}
