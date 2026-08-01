import { listMemories } from '@/modules/ai/memory/api/memory'
import { formatMemoriesForPrompt } from '@/modules/ai/memory/formatMemoriesForPrompt'

/** Prompt-sized cap — smaller than formatMemoriesForPrompt's own default, matching retrieveGraphContext's MAX_NODES/MAX_RELATIONSHIPS bounding for the same reason: this is supplementary context, not the main event. Exported so the Memory page can show which stored memories actually make it into the prompt, without duplicating this number. */
export const MAX_MEMORIES_PER_TYPE = 10

export interface RetrieveMemoryContextParams {
  userId: string
  workspaceId: string | null
}

/**
 * Phase UX-5.1: the memory counterpart to retrieveGraphContext — same
 * contract (swallows every error and returns null; a missing/empty
 * ai_memory table must never break chat), same "additive context, not a
 * change to what already gets retrieved" shape. `userId` isn't used in
 * the query (RLS already scopes ai_memory to auth.uid()) but is kept in
 * the signature to match retrieveContext/retrieveGraphContext's call
 * shape and leave room for an explicit filter later.
 *
 * Called from AIService.sendMessage on every chat turn, feeding
 * buildSystemPrompt alongside retrieveContext/retrieveGraphContext.
 */
export async function retrieveMemoryContext(params: RetrieveMemoryContextParams): Promise<string | null> {
  try {
    const memories = await listMemories({ workspaceId: params.workspaceId })
    if (memories.length === 0) return null
    const text = formatMemoriesForPrompt(memories, { maxPerType: MAX_MEMORIES_PER_TYPE })
    return text || null
  } catch {
    return null
  }
}
