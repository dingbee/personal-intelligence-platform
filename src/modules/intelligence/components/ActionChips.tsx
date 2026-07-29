import type { Command, CommandActions, CommandContext } from '@/modules/commands/types'

/** UX-7 Phase 6 — renders whatever deriveActionChips returned; clicking one calls command.execute exactly like the Command Bar does. */
export function ActionChips({
  commands,
  context,
  actions,
}: {
  commands: Command[]
  context: CommandContext
  actions: CommandActions
}) {
  if (commands.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {commands.map((command) => (
        <button
          key={command.id}
          type="button"
          onClick={() => void command.execute(context, actions)}
          className="inline-flex items-center gap-1.5 rounded-pill border border-[var(--color-border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs text-[var(--color-ink)] shadow-raised transition-shadow hover:shadow-floating"
        >
          <span aria-hidden>{command.icon}</span>
          {command.title}
        </button>
      ))}
    </div>
  )
}
