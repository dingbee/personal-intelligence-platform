import { listDocumentChunks } from '@/modules/processing/api/chunks'
import { boundContent } from '@/modules/knowledge-intelligence/api/knowledgeExtraction'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { parseDocumentIntelligenceResponse } from '@/modules/processing/documentIntelligence/parseDocumentIntelligenceResponse'
import { saveDocumentIntelligence } from '@/modules/processing/api/extractionMetadata'
import type { DocumentIntelligence } from '@/shared/types/database'

/**
 * Multimodal Intelligence v1/v2 — Document Intelligence: pure text
 * classification/extraction, reusing the exact bound-content +
 * runCapability pattern runKnowledgeExtraction established (boundContent
 * is exported from there for exactly this reuse). No new AI provider or
 * embedding call.
 *
 * v2 — generalized the same way runKnowledgeExtraction was in v1:
 * runDocumentIntelligenceFromContent is the actual capability call
 * (compute only, no persistence — callers decide where a result belongs),
 * so Multimodal Intelligence v2 can apply the identical capability/parser
 * to an asset's analyzed text (assets.metadata.documentIntelligence) with
 * zero new capability, zero new prompt. runDocumentIntelligence remains
 * the document-scoped, chunk-fetching, extraction_metadata-persisting
 * entry point every existing call site already uses, unchanged in
 * behavior.
 */
export async function runDocumentIntelligenceFromContent(params: {
  content: string
  userId: string
  workspaceId: string | null
  chain: string[]
}): Promise<DocumentIntelligence> {
  const { content, userId, workspaceId, chain } = params

  const { result, providerId } = await runWithFallback(chain, (candidateId) =>
    runCapability({
      capabilityId: 'analyze-document-intelligence',
      variables: { content },
      userId,
      workspaceId,
      providerId: candidateId,
      requestedProviderId: chain[0],
    }),
  )

  const parsed = parseDocumentIntelligenceResponse(result.content)
  return { ...parsed, analyzedAt: new Date().toISOString(), provider: providerId }
}

export async function runDocumentIntelligence(params: {
  documentId: string
  userId: string
  workspaceId: string | null
  chain: string[]
}): Promise<DocumentIntelligence> {
  const { documentId, userId, workspaceId, chain } = params

  const chunks = await listDocumentChunks(documentId)
  if (chunks.length === 0) {
    throw new Error('This document has no processed content to analyze yet.')
  }
  const { content } = boundContent(chunks)

  const documentIntelligence = await runDocumentIntelligenceFromContent({ content, userId, workspaceId, chain })
  await saveDocumentIntelligence(documentId, documentIntelligence)
  return documentIntelligence
}
