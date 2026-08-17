import { commandRegistry } from '@/modules/commands/registry'
import { buildContinueReadingCommand } from '@/modules/commands/commands/readerCommands'
import type { Command, CommandActions, CommandContext } from '@/modules/commands/types'

/**
 * Resolves one Reasoning Planner suggestedCommandIds entry against the
 * exact same command sources NovaCommandBar/deriveActionChips already
 * draw from — never a new command or a new lookup mechanism.
 * 'reader-continue' is the one id that's never in the static
 * commandRegistry (its title needs the actual in-progress book name, so
 * it's built per-render — see readerCommands.ts's own comment); every
 * other id is a plain registry lookup. Returns null (never a broken
 * button) when the id doesn't resolve to a real command, or resolves but
 * isn't available in the current context.
 */
function resolveSuggestedCommand(id: string, context: CommandContext): Command | null {
  if (id === 'reader-continue') return buildContinueReadingCommand(context)
  const command = commandRegistry.get(id)
  if (!command) return null
  if (command.isAvailable && !command.isAvailable(context)) return null
  return command
}

/**
 * UX-14.2 Planner Integration, Phase 2 — surfaces the Reasoning Planner's
 * suggestedCommandIds (computed every turn in buildReasoningPlan, see
 * planningRules.ts) as a small action row next to the Reasoning
 * indicators. This was previously computed and tested but never rendered
 * anywhere (see planner.test.ts vs. the prior absence of any consumer).
 *
 * Deliberately distinct from two existing, unrelated mechanisms it sits
 * next to, both left untouched:
 *   - NovaSuggestions: follow-up QUESTIONS to ask NOVA next.
 *   - ActionChips/deriveActionChips: a fixed, context-only (not
 *     intent-aware) action set shown regardless of what was just asked.
 * This row is specifically "what the planner determined is useful to DO
 * right now" — a different, per-turn-contextual source, resolved through
 * the exact same commandRegistry/CommandActions the Command Bar and
 * ActionChips already use. No new command definitions, no new dispatch
 * path — clicking a chip calls command.execute exactly like Cmd+K does.
 */
export function SuggestedCommandActions({
  commandIds,
  context,
  actions,
}: {
  commandIds: string[]
  context: CommandContext
  actions: CommandActions
}) {
  const commands = commandIds
    .map((id) => resolveSuggestedCommand(id, context))
    .filter((command): command is Command => command !== null)

  if (commands.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-[var(--color-ink-muted)]">Suggested next steps</span>
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          onClick={() => void command.execute(context, actions)}
          className="inline-flex items-center gap-1.5 rounded-pill border border-[var(--color-border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs text-[var(--color-ink)] shadow-raised transition-shadow hover:shadow-floating focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
        >
          <span aria-hidden>{command.icon}</span>
          {command.title}
        </button>
      ))}
    </div>
  )
}
