import { listDocumentChunks } from '@/modules/processing/api/chunks'
import { boundContent } from '@/modules/knowledge-intelligence/api/knowledgeExtraction'
import { runCapability } from '@/modules/ai/orchestration/runCapability'
import { runWithFallback } from '@/modules/ai/router/runWithFallback'
import { parseDocumentIntelligenceResponse } from '@/modules/processing/documentIntelligence/parseDocumentIntelligenceResponse'
import { saveDocumentIntelligence } from '@/modules/processing/api/extractionMetadata'
import type { DocumentIntelligence } from '@/shared/types/database'

/**
 * Multimodal Intelligence v1 — Document Intelligence: pure text
 * classification/extraction, reusing the exact chunk-fetch + bound-content
 * + runCapability pattern runKnowledgeExtraction already established
 * (boundContent is exported from there for exactly this reuse). No new AI
 * provider or embedding call.
 */
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
  const documentIntelligence: DocumentIntelligence = {
    ...parsed,
    analyzedAt: new Date().toISOString(),
    provider: providerId,
  }

  await saveDocumentIntelligence(documentId, documentIntelligence)
  return documentIntelligence
}
