import type { Reference } from '@/modules/intelligence/references/referenceTypes'
import type { ArtifactKind } from '@/modules/ai/artifacts/artifactTypes'

export interface WorkspaceActionContext {
  userId: string
  workspaceId: string | null
  conversationId: string
  /** Ordered provider candidates — only actions that call an LLM (e.g. Generate Briefing) need this. */
  chain: string[]
}

/**
 * UX-14.4.3 — an artifact-agnostic preview contract, not a spreadsheet-
 * specific one: `content` is whatever renderable text the artifact kind
 * produces today (markdown, for the one kind that populates this —
 * `generateSpreadsheetArtifactAction`), `summary`/`metadata` are reserved
 * for a future kind that needs more than a title + renderable body,
 * without requiring another field to be added later. Purely a UI signal —
 * nothing here is persisted; the note that eventually gets saved (if any)
 * is built from `WorkspaceActionOutcome.responseText`, unchanged, via the
 * existing Save-to-Notes pipeline.
 */
export interface ArtifactPreview {
  id?: string
  kind: ArtifactKind
  title: string
  summary?: string
  content?: string
  metadata?: Record<string, unknown>
}

export interface WorkspaceActionOutcome {
  /**
   * Shown back to the user as NOVA's chat reply, and — unchanged by this
   * field's addition — exactly what gets persisted into `messages.content`
   * and later re-parsed by the Save-to-Notes pipeline
   * (`detectArtifactKind`/`parseMarkdownTableToArtifact`). Never derive
   * `responseText` from `artifactPreview` or vice versa in a way that lets
   * them drift — both must independently describe the same artifact.
   */
  responseText: string
  /** Optional — lets an action surface a reference chip (e.g. the note it created) the same way a normal chat answer can. */
  references?: Reference[]
  /** Optional — when present, the chat UI renders a structured card (KnowledgeCard-based) for this response instead of plain markdown. Ephemeral: never persisted, only available for the turn it was returned in. */
  artifactPreview?: ArtifactPreview
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
