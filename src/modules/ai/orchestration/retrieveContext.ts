import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import { supabaseVectorStore } from '@/modules/ai/retrieval/SupabaseVectorStore'
import type { VectorMatch } from '@/modules/ai/retrieval/VectorStore'

const embeddingProvider = new OpenAIEmbeddingProvider()

/** Embeds the user's query and finds the most relevant chunks — scoped to one document, or the whole library. */
export async function retrieveContext(params: {
  query: string
  userId: string
  workspaceId: string | null
  documentId?: string
}): Promise<VectorMatch[]> {
  const [embedding] = await embeddingProvider.embed([params.query], {
    userId: params.userId,
    workspaceId: params.workspaceId,
    feature: 'retrieval',
  })
  return supabaseVectorStore.query(embedding!, {
    documentId: params.documentId,
    // Only apply the workspace filter for whole-library chat — a
    // document-scoped conversation should always find that document's
    // chunks even if the workspace switcher has since moved elsewhere.
    workspaceId: params.documentId ? undefined : params.workspaceId,
    matchCount: 8,
  })
}
