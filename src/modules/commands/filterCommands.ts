import type { Command, CommandContext } from '@/modules/commands/types'

function isAvailable(command: Command, context: CommandContext): boolean {
  return command.isAvailable ? command.isAvailable(context) : true
}

/** Lower is better — a title match ranks above a description match, which ranks above a category match. */
function matchRank(command: Command, needle: string): number | null {
  const title = command.title.toLowerCase()
  const description = (command.description ?? '').toLowerCase()
  const category = command.category.toLowerCase()

  if (title.startsWith(needle)) return 0
  if (title.includes(needle)) return 1
  if (description.includes(needle)) return 2
  if (category.includes(needle)) return 3
  return null
}

/**
 * Pure, testable filtering/ranking — the Command Bar UI just calls this
 * with the full candidate pool for the current render (registered static
 * commands plus any dynamically-generated ones, e.g. per-workspace switch
 * commands or a synthesized "Ask NOVA: <query>" entry) and gets back what
 * to display. Availability (isAvailable/context) is always applied first,
 * regardless of query — an unavailable command never shows up, matched or
 * not.
 */
export function filterCommands(params: { commands: Command[]; query: string; context: CommandContext }): Command[] {
  const { commands, query, context } = params
  const available = commands.filter((command) => isAvailable(command, context))

  const trimmed = query.trim().toLowerCase()
  if (!trimmed) {
    return available.filter((command) => command.featured)
  }

  return available
    .map((command) => ({ command, rank: matchRank(command, trimmed) }))
    .filter((entry): entry is { command: Command; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.command)
}
