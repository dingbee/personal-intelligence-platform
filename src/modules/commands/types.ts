export type CommandCategory = 'navigation' | 'workspace' | 'ai' | 'search' | 'notes' | 'reader' | 'settings' | 'memory'

/** What a command's isAvailable/execute can read about "here and now" — resolved once per render by useCommandContext. */
export interface CommandContext {
  userId: string
  workspaceId: string | null
  workspaceName: string | null
  pathname: string
  documentId: string | null
  inProgressDocument: { id: string; title: string } | null
}

/** The pre-wired callbacks a command's execute calls into — the one place React hooks/mutations actually live (useCommandActions), so command definitions themselves stay plain data. */
export interface CommandActions {
  navigate: (path: string) => void
  setCurrentWorkspaceId: (id: string | null) => void
  createNote: () => Promise<{ id: string }>
  createConversationWithQuery: (query: string) => Promise<{ id: string }>
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
