import { supabase } from '@/shared/lib/supabase'
import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import type { Message } from '@/shared/types/database'

const embeddingProvider = new OpenAIEmbeddingProvider()

/**
 * Fire-and-forget, like processDocument() after upload — chat stays
 * responsive, and a message that fails to index just doesn't show up in
 * search until "Reprocess" gets built for messages too (or the user resends).
 */
export async function indexMessage(message: Message, workspaceId: string | null): Promise<void> {
  try {
    const [embedding] = await embeddingProvider.embed([message.content], {
      userId: message.user_id,
      workspaceId,
      feature: 'indexing',
    })
    const { error } = await supabase
      .from('message_embeddings')
      .upsert(
        { message_id: message.id, model: embeddingProvider.modelName, embedding: embedding! },
        { onConflict: 'message_id' },
      )
    if (error) throw error
  } catch (err) {
    console.error(`Failed to index message ${message.id} for search:`, err)
  }
}
