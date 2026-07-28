import type { DocumentChunk, KnowledgeNode } from '@/shared/types/database'
import { listDocumentChunks } from '@/modules/processing/api/chunks'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { DEFAULT_CHAT_PROVIDER_ID } from '@/modules/ai/providers/registry'
import { upsertKnowledgeNodes } from '@/modules/knowledge-intelligence/api/knowledgeNodes'
import { upsertKnowledgeEdges } from '@/modules/knowledge-intelligence/api/knowledgeEdges'
import {
  parseConceptsResponse,
  parseEntitiesResponse,
  parseRelationshipsResponse,
} from '@/modules/knowledge-intelligence/utils/parseKnowledgeExtractionResponse'

/** Bounds how much document content goes into a single extraction prompt — same truncation-consciousness as the chunker's MAX_CHUNK_CHARS, just applied at the prompt-assembly end instead of the chunking end. */
const MAX_CONTENT_CHARS = 12000

function boundContent(chunks: DocumentChunk[]): { content: string; chunkIds: string[] } {
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
}

export interface KnowledgeExtractionResult {
  concepts: KnowledgeNode[]
  entities: KnowledgeNode[]
  edgesCreated: number
}

/**
 * Document -> extract concepts/entities -> detect relationships between
 * them -> persist. Every step reuses existing infrastructure: runCapability
 * for execution (which itself logs to ai_requests), upsertKnowledgeNodes/
 * upsertKnowledgeEdges for persistence (upsert, so re-running is a refresh,
 * never a duplicate or a delete). No new AI provider or embedding call —
 * see the Phase 7A audit for why source_chunk_ids substitutes for a
 * per-node embedding.
 */
export async function runKnowledgeExtraction(params: RunKnowledgeExtractionParams): Promise<KnowledgeExtractionResult> {
  const { documentId, userId, workspaceId } = params

  const chunks = await listDocumentChunks(documentId)
  if (chunks.length === 0) {
    throw new Error('This document has no processed content to extract from yet.')
  }
  const { content, chunkIds } = boundContent(chunks)
  const generatedAt = new Date().toISOString()

  const [conceptsRun, entitiesRun] = await Promise.all([
    runCapability({ capabilityId: 'extract-concepts', variables: { content }, userId, workspaceId }),
    runCapability({ capabilityId: 'extract-entities', variables: { content }, userId, workspaceId }),
  ])

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
        sourceType: 'document',
        sourceId: documentId,
        sourceChunkIds: chunkIds,
        generationMetadata: {
          capability: 'extract-concepts',
          provider: DEFAULT_CHAT_PROVIDER_ID,
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
        sourceType: 'document',
        sourceId: documentId,
        sourceChunkIds: chunkIds,
        generationMetadata: {
          capability: 'extract-entities',
          provider: DEFAULT_CHAT_PROVIDER_ID,
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
  })
  const relationshipItems = parseRelationshipsResponse(relationshipsRun.content)

  const nodesByTitle = new Map(allNodes.map((node) => [node.title, node]))
  const edges = relationshipItems.flatMap((item) => {
    const source = nodesByTitle.get(item.source)
    const target = nodesByTitle.get(item.target)
    if (!source || !target || source.id === target.id) return []
    return [
      {
        userId,
        workspaceId,
        sourceType: 'knowledge_node',
        sourceId: source.id,
        targetType: 'knowledge_node',
        targetId: target.id,
        relationshipType: item.relationshipType,
        confidence: item.confidence,
        generatedBy: 'ai:detect-relationships',
      },
    ]
  })

  await upsertKnowledgeEdges(edges)

  return { concepts, entities, edgesCreated: edges.length }
}
