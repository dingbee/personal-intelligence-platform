import type { Reference } from '@/modules/intelligence/references/referenceTypes'

export interface WorkspaceActionContext {
  userId: string
  workspaceId: string | null
  conversationId: string
  /** Ordered provider candidates — only actions that call an LLM (e.g. Generate Briefing) need this. */
  chain: string[]
}

export interface WorkspaceActionOutcome {
  /** Shown back to the user as NOVA's chat reply. */
  responseText: string
  /** Optional — lets an action surface a reference chip (e.g. the note it created) the same way a normal chat answer can. */
  references?: Reference[]
}

/**
 * AI Workspace Actions v1 — a natural-language command that resolves to a
 * concrete platform action instead of a conversational answer. `match` is
 * pure and deterministic (a phrase pattern, not an LLM intent call) — same
 * reasoning as the rest of this codebase's deterministic-vs-LLM split
 * (matchKnownConcepts, computeKnowledgeConfidence): recognizing that the
 * user asked for an action is fast, free, and predictable, so no model
 * call is spent deciding that. `TPayload` carries whatever `match`
 * extracted (a topic, a scope, ...) through to `run`.
 */
export interface WorkspaceAction<TPayload> {
  id: string
  match: (text: string) => TPayload | undefined
  run: (payload: TPayload, context: WorkspaceActionContext) => Promise<WorkspaceActionOutcome>
}
