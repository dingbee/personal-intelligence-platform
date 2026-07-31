import { supabase } from '@/shared/lib/supabase'
import { OpenAIEmbeddingProvider } from '@/modules/ai/embeddings/OpenAIEmbeddingProvider'
import type { Note } from '@/shared/types/database'

const embeddingProvider = new OpenAIEmbeddingProvider()

/**
 * UX-13.11 Universal Search Phase 1 — same fire-and-forget contract as
 * indexMessage: called from the hooks that create/update a note (not the
 * raw API functions), swallows its own errors, never blocks the UI on a
 * failed index. A note with no content yet (e.g. a freshly-created
 * "Untitled note") has nothing worth embedding, so it's skipped until it
 * actually has content — re-saving with real content indexes it then.
 */
export async function indexNote(note: Note, workspaceId: string | null): Promise<void> {
  const text = [note.title, note.content].filter((part) => part.trim().length > 0).join('\n\n')
  if (!note.content.trim()) return

  try {
    const [embedding] = await embeddingProvider.embed([text], {
      userId: note.user_id,
      workspaceId,
      feature: 'indexing',
    })
    const { error } = await supabase
      .from('note_embeddings')
      .upsert(
        { note_id: note.id, model: embeddingProvider.modelName, embedding: embedding! },
        { onConflict: 'note_id' },
      )
    if (error) throw error
  } catch (err) {
    console.error(`Failed to index note ${note.id} for search:`, err)
  }
}
