import type { Command, CommandContext } from '@/modules/commands/types'

/**
 * Generated per-render (not a static registered command) so its title can
 * include the actual book name — "Continue reading Atomic Habits" reads
 * far better than a generic "Continue reading". Returns null when there's
 * nothing in progress (resolved by useCommandContext from
 * getMostRecentReadingProgress, the same query the greeting engine uses).
 */
export function buildContinueReadingCommand(context: CommandContext): Command | null {
  if (!context.inProgressDocument) return null
  const { id, title } = context.inProgressDocument
  return {
    id: 'reader-continue',
    title: `Continue reading ${title}`,
    icon: '📚',
    category: 'reader',
    featured: true,
    execute: (_ctx, actions) => actions.navigate(`/library/${id}/read`),
  }
}
