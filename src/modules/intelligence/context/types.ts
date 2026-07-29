/** What workspace the user is in and how active it's been — reuses getWorkspaceHeaderSummary, not a new query shape. */
export interface WorkspaceContext {
  workspaceId: string | null
  workspaceName: string | null
  documentCount: number
  lastActivityAt: string | null
}

/** What the user is doing right now / just did — reading progress + a glance at recent conversations. */
export interface ActivityContext {
  inProgressDocument: { id: string; title: string; updatedAt: string } | null
  /** Most-recent-first, capped small — a glance, not a full history browse (that's ConversationList's job). Carries id (UX-7 Phase 9's timeline links to them), not just title. */
  recentConversations: { id: string; title: string }[]
}

/** Reuses the same formatted text retrieveGraphContext already produced this turn — never re-queried. */
export interface KnowledgeContext {
  graphSummary: string | null
  nodeCount: number
}

/** Reuses the same formatted text retrieveMemoryContext already produced this turn — never re-queried. */
export interface MemoryContext {
  formattedText: string | null
  memoryCount: number
}

export interface UserContext {
  displayName: string
}

/** UX-11 Phase 10 — the single highest-priority item from the Attention Center (dashboardSignals.rankAttentionItems), reusing UX-8's attentionEngine. Only the top item, kept deliberately compact — this is situational-prompt text, not the full dashboard. */
export interface AttentionContext {
  topItem: { message: string }
}

/** UX-13 — a compact summary of the current workspace's evolution report (maturity, knowledge health, top forecast), reusing buildWorkspaceEvolutionReport rather than recomputing anything. Null when there's no current workspace (evolution is inherently workspace-scoped) or the report fails to build. */
export interface EvolutionContext {
  summary: string
}

/**
 * The NOVA Context Engine's aggregate output (UX-6 Phase 2). Every field
 * is independently optional by design — a failure resolving one source
 * degrades that field to null, it never fails the whole call (see
 * contextResolver.ts).
 */
export interface NovaContext {
  workspaceContext: WorkspaceContext | null
  activityContext: ActivityContext | null
  knowledgeContext: KnowledgeContext | null
  memoryContext: MemoryContext | null
  userContext: UserContext | null
  attentionContext: AttentionContext | null
  evolutionContext: EvolutionContext | null
}
