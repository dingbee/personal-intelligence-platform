import type { WorkspaceAction, WorkspaceActionContext, WorkspaceActionOutcome } from '@/modules/workspace-actions/types'

/**
 * AI Workspace Actions v1 — the Workspace Action Router. Actions register
 * themselves here (see registerBuiltInWorkspaceActions.ts), each with its
 * own `match`; the router just tries them in registration order and runs
 * the first one that matches. This replaces what was, before this
 * workstream, a single hardcoded `if (parseExecutiveBriefingCommand(text))`
 * branch inside AIService.sendMessage — that pattern doesn't scale past
 * one command, and a second command (Save to Notes) just arrived.
 */
const actions: WorkspaceAction<unknown>[] = []

export function registerWorkspaceAction<TPayload>(action: WorkspaceAction<TPayload>): void {
  actions.push(action as WorkspaceAction<unknown>)
}

export function matchWorkspaceAction(text: string): { action: WorkspaceAction<unknown>; payload: unknown } | null {
  for (const action of actions) {
    const payload = action.match(text)
    if (payload !== undefined) return { action, payload }
  }
  return null
}

/** Returns null when no registered action recognizes `text` — the caller falls through to the normal chat path. */
export async function runWorkspaceAction(text: string, context: WorkspaceActionContext): Promise<WorkspaceActionOutcome | null> {
  const matched = matchWorkspaceAction(text)
  if (!matched) return null
  return matched.action.run(matched.payload, context)
}
