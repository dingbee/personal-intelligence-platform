export interface ContextTrace {
  retrievedChunks: number
  graphNodes: number
  memoriesUsed: number
}

/**
 * Best-effort internal visibility into what fed a chat response — logged
 * (not persisted, not shown to the user) so "why did NOVA answer this
 * way" is at least answerable in dev tools until a real trace UI exists
 * (later phase). retrievedChunks is exact — matches.length. graphNodes/
 * memoriesUsed are NOT: retrieveGraphContext/retrieveMemoryContext
 * return already-formatted text (string | null) by design — Phase UX-5.2
 * wires them in exactly as built, not by changing their contract to also
 * return structured counts — so this counts lines in that text instead.
 * Coupled to buildGraphContextText's "Concept: X"/"Entity: X" node lines
 * and formatMemoriesForPrompt's "- " bullets; the test file builds real
 * context blocks through those actual functions (not hand-typed
 * fixtures), so a future format change that breaks this counting fails
 * the test suite instead of silently drifting.
 */
export function buildContextTrace(
  matchCount: number,
  graphContext: string | null | undefined,
  memoryContext: string | null | undefined,
): ContextTrace {
  const graphNodes = graphContext ? (graphContext.match(/^(Concept|Entity): /gm) ?? []).length : 0
  const memoriesUsed = memoryContext ? (memoryContext.match(/^- /gm) ?? []).length : 0
  return { retrievedChunks: matchCount, graphNodes, memoriesUsed }
}
