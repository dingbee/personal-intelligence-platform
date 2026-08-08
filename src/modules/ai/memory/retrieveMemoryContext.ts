import { listMemories } from '@/modules/ai/memory/api/memory'
import { formatMemoriesForPrompt } from '@/modules/ai/memory/formatMemoriesForPrompt'
import { filterMemoriesByRelevance } from '@/modules/ai/memory/filterMemoriesByRelevance'

/** Prompt-sized cap — smaller than formatMemoriesForPrompt's own default, matching retrieveGraphContext's MAX_NODES/MAX_RELATIONSHIPS bounding for the same reason: this is supplementary context, not the main event. Exported so the Memory page can show which stored memories actually make it into the prompt, without duplicating this number. */
export const MAX_MEMORIES_PER_TYPE = 10

/**
 * PIP Sprint 9/10 — `listMemories` was called here with no `.limit()`,
 * fetching every active memory the user has (across every workspace, if
 * `workspaceId` is null) on every single chat turn, then discarding all
 * but ~30 of them (MAX_MEMORIES_PER_TYPE × 3 types) after relevance
 * filtering and ranking. For most users this is a small table and the
 * cost is negligible — but nothing bounded it, so a long-lived, heavy
 * user (months of auto-detected `conversation_memory` rows) would see
 * this query's cost grow without limit, forever. `listMemories` already
 * orders by `updated_at desc` — the same ordering `rankMemories` uses as
 * its tie-break — so capping the fetch at a generous multiple of what's
 * ever actually used (30) doesn't change which memories are selected for
 * any realistic account; it only stops the query from scanning/
 * transferring rows that were always going to be discarded.
 */
const MEMORY_FETCH_LIMIT = 200

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
    const memories = await listMemories({ workspaceId: params.workspaceId, limit: MEMORY_FETCH_LIMIT })
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
