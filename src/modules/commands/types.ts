import type { InProgressDocument } from '@/modules/reader/api/readingProgress'

export type CommandCategory = 'navigation' | 'workspace' | 'ai' | 'search' | 'notes' | 'reader' | 'settings' | 'memory' | 'capture'

/** What a command's isAvailable/execute can read about "here and now" — resolved once per render by useCommandContext. */
export interface CommandContext {
  userId: string
  workspaceId: string | null
  workspaceName: string | null
  pathname: string
  documentId: string | null
  /** UX-15.2 — widened to the full InProgressDocument (adds updatedAt) so Hub's ContinueWorkingCard can show "last read …" without a second query. */
  inProgressDocument: InProgressDocument | null
}

/** The pre-wired callbacks a command's execute calls into — the one place React hooks/mutations actually live (useCommandActions), so command definitions themselves stay plain data. */
export interface CommandActions {
  navigate: (path: string) => void
  setCurrentWorkspaceId: (id: string | null) => void
  createNote: () => Promise<{ id: string }>
  createConversationWithQuery: (query: string) => Promise<{ id: string }>
  /**
   * PIP Multimodal Intelligence Stabilization v1 — deliberately distinct
   * from createConversationWithQuery: a note's content can be arbitrarily
   * long ("substantial work"), and createConversationWithQuery carries its
   * seed text through a URL query param (?initialQuery=), which real
   * browsers/servers cap at a few thousand characters. This instead
   * navigates with just the note id (?initialNoteId=) and lets ChatPage
   * fetch the note and build the seed message itself once mounted — see
   * ChatPage.tsx's initialNoteId effect.
   */
  createConversationWithNoteAnalysis: (noteId: string, noteTitle: string) => Promise<{ id: string }>
  /** Opens the global Quick Capture dialog (UX-13 Knowledge Capture) — owned by AppShell alongside commandBarOpen. */
  openQuickCapture: () => void
}

export interface Command {
  id: string
  title: string
  description?: string
  /** A single emoji, consistent with the rest of the app's icon usage. */
  icon: string
  category: CommandCategory
  shortcut?: string
  /** Shown in the curated default list before the user types anything. */
  featured?: boolean
  /** Omitted = always available. */
  isAvailable?: (context: CommandContext) => boolean
  execute: (context: CommandContext, actions: CommandActions) => void | Promise<void>
}
