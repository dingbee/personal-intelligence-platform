import { commandRegistry } from '@/modules/commands/registry'
import { buildContinueReadingCommand } from '@/modules/commands/commands/readerCommands'
import type { Command, CommandContext } from '@/modules/commands/types'

/**
 * UX-7 Phase 6 — deliberately just the existing registry commands whose
 * intent matches the brief's action list (Create Note, Search Library,
 * Manage Memories, Switch Workspace) plus the same dynamic "Continue
 * reading" builder the Command Bar uses. No new command definitions, no
 * new execution path — invoking a chip calls command.execute exactly like
 * Cmd+K does. "Summarize"/"Flashcards"/"Open Reader" aren't included: they
 * don't exist as document-agnostic registry commands today (they're
 * embedded in ReaderPage's own tabs) — see the phase report's deferred
 * items rather than inventing new ones here.
 */
const ACTION_CHIP_COMMAND_IDS = ['notes-create', 'search-open', 'workspace-manage', 'memory-manage']

export function deriveActionChips(context: CommandContext): Command[] {
  const fromRegistry = commandRegistry
    .list()
    .filter((command) => ACTION_CHIP_COMMAND_IDS.includes(command.id))
    .filter((command) => (command.isAvailable ? command.isAvailable(context) : true))

  const continueReading = buildContinueReadingCommand(context)
  return continueReading ? [continueReading, ...fromRegistry] : fromRegistry
}
