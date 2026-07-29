export interface TemporaryWorkspaceItem {
  sourceType: string
  sourceId: string
  title: string
  href: string
}

/**
 * UX-7 Phase 7 — "Collect everything about X." Exists only in memory
 * (whatever component state holds it); nothing here is written to the
 * database. Scoped to what the existing search registry actually returns
 * (documents, conversations) — see buildTemporaryWorkspace.ts for why
 * notes/graph nodes aren't included in this pass.
 */
export interface TemporaryWorkspace {
  topic: string
  documents: TemporaryWorkspaceItem[]
  conversations: TemporaryWorkspaceItem[]
  createdAt: string
}
