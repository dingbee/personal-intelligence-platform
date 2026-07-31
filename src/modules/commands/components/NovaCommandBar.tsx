import { useEffect, useMemo, useRef, useState } from 'react'
import { commandRegistry } from '@/modules/commands/registry'
import { filterCommands } from '@/modules/commands/filterCommands'
import { useCommandContext } from '@/modules/commands/hooks/useCommandContext'
import { useCommandActions } from '@/modules/commands/hooks/useCommandActions'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import { buildWorkspaceSwitchCommands } from '@/modules/commands/commands/workspaceCommands'
import { buildContinueReadingCommand } from '@/modules/commands/commands/readerCommands'
import { buildAskNovaQueryCommand } from '@/modules/commands/commands/aiCommands'
import { buildSearchQueryCommand } from '@/modules/commands/commands/searchCommands'
import type { Command } from '@/modules/commands/types'

/**
 * The universal Command Bar (Phase UX-4) — Cmd/Ctrl+K, the TopBar entry
 * point, or mobile's search icon all open this same component. Built on
 * the native <dialog> element, same pattern as ConfirmDialog/
 * MobileNavDrawer; styled with the UX-3.5 floating-surface tokens
 * directly rather than a new FloatingCard variant, since this needs
 * full-screen-on-mobile behavior FloatingCard doesn't provide.
 */
export function NovaCommandBar({
  open,
  onClose,
  onOpenQuickCapture,
}: {
  open: boolean
  onClose: () => void
  onOpenQuickCapture: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const context = useCommandContext()
  const actions = useCommandActions({ onOpenQuickCapture })
  const { workspaces } = useWorkspace()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      setQuery('')
      setSelectedIndex(0)
      // showModal() moves focus to the dialog itself first — grab the input on the next tick.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const results = useMemo(() => {
    const trimmed = query.trim()
    const pool: Command[] = [
      ...commandRegistry.list(),
      ...buildWorkspaceSwitchCommands(workspaces, context),
      ...([buildContinueReadingCommand(context)].filter(Boolean) as Command[]),
    ]
    const filtered = filterCommands({ commands: pool, query, context })
    if (!trimmed) return filtered
    // The two "smart" actions always trail the list when there's a typed
    // query — they're always a valid match for whatever was typed, so
    // ranking them against the static pool would be meaningless.
    return [...filtered, buildAskNovaQueryCommand(trimmed), buildSearchQueryCommand(trimmed)]
  }, [query, workspaces, context])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  function runCommand(command: Command) {
    void command.execute(context, actions)
    onClose()
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex((index) => Math.min(index + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const selected = results[selectedIndex]
      if (selected) runCommand(selected)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      aria-label="NOVA Command"
      className="inset-0 m-0 h-full max-h-none w-full max-w-none flex-col overflow-hidden border-0 bg-[var(--surface-floating)] p-0 open:flex md:inset-auto md:top-24 md:left-1/2 md:h-auto md:max-h-[70vh] md:w-full md:max-w-lg md:-translate-x-1/2 md:rounded-panel md:border md:border-[var(--color-border)] md:shadow-floating backdrop:bg-black/30"
    >
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] p-4">
        <span aria-hidden className="text-lg text-[var(--color-accent)]">
          ✨
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What would you like to do?"
          aria-label="NOVA command input"
          className="flex-1 bg-transparent text-base text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)]"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close command bar"
          className="rounded-control px-2 py-1 text-sm text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--surface-base)] hover:text-[var(--color-ink)]"
        >
          Esc
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {results.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-[var(--color-ink-muted)]">
            Nothing matches "{query}" — try a different word, or ask NOVA directly.
          </p>
        ) : (
          <ul role="listbox" aria-label="Commands">
            {results.map((command, index) => (
              <li key={command.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === selectedIndex}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => runCommand(command)}
                  className={`flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left transition-colors ${
                    index === selectedIndex ? 'bg-[var(--surface-base)]' : ''
                  }`}
                >
                  <span aria-hidden className="text-lg">
                    {command.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--color-ink)]">
                      {command.title}
                    </span>
                    {command.description && (
                      <span className="block truncate text-xs text-[var(--color-ink-muted)]">
                        {command.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  )
}
