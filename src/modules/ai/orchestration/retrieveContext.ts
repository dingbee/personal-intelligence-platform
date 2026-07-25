import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import { supabaseVectorStore } from '@/modules/ai/retrieval/SupabaseVectorStore'
import type { VectorMatch } from '@/modules/ai/retrieval/VectorStore'

const embeddingProvider = new OpenAIEmbeddingProvider()

/** Embeds the user's query and finds the most relevant chunks — scoped to one document, or the whole library. */
export async function retrieveContext(query: string, documentId?: string): Promise<VectorMatch[]> {
  const [embedding] = await embeddingProvider.embed([query])
  return supabaseVectorStore.query(embedding!, { documentId, matchCount: 8 })
}
