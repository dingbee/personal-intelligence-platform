import { listMemories } from '@/modules/ai/memory/api/memory'
import { formatMemoriesForPrompt } from '@/modules/ai/memory/formatMemoriesForPrompt'
import { filterMemoriesByRelevance } from '@/modules/ai/memory/filterMemoriesByRelevance'

/** Prompt-sized cap — smaller than formatMemoriesForPrompt's own default, matching retrieveGraphContext's MAX_NODES/MAX_RELATIONSHIPS bounding for the same reason: this is supplementary context, not the main event. Exported so the Memory page can show which stored memories actually make it into the prompt, without duplicating this number. */
export const MAX_MEMORIES_PER_TYPE = 10

export interface RetrieveMemoryContextParams {
  userId: string
  workspaceId: string | null
  /** PIP Sprint 6/10 — the current turn's message, used by filterMemoriesByRelevance to exclude conversation_memory rows unrelated to what's actually being asked. */
  text: string
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
    const relevant = filterMemoriesByRelevance(memories, params.text)
    if (relevant.length === 0) return null
    const text = formatMemoriesForPrompt(relevant, { maxPerType: MAX_MEMORIES_PER_TYPE })
    return text || null
  } catch (err) {
    // PIP Sprint 8/10 — same never-throws contract, now with a trace: a
    // genuine failure here (e.g. a broken ai_memory query) was previously
    // indistinguishable from "the user has no relevant memories" even in
    // server logs.
    console.error('retrieveMemoryContext failed — chat continues without personal_context:', err)
    return null
  }
}
