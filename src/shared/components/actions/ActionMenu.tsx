import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { DropdownMenu, DropdownMenuItem } from '@/shared/components/ui/DropdownMenu'
import { getActionDefinition, type ActionId } from '@/modules/actions/actionRegistry'

export interface ResolvedAction {
  /**
   * Registry id, when this item is one of the unified action types —
   * used only to look up the default `destructive` styling; the label
   * below always wins over the registry's own (several of these are
   * two-state toggles, e.g. "Unpin"/"Restore"). Omit for a card's own
   * bespoke action that isn't part of the unified taxonomy (e.g. "Save
   * as Notes", "Reprocess") — `key` is then derived from `label`.
   */
  id?: ActionId
  label: string
  /** Either a click handler (a real mutation) or an `href` (a plain navigation item, e.g. "Edit"/"View") — exactly one should be set. */
  onSelect?: () => void
  href?: string
  /** Overrides the registry's own destructive default for this specific call site; required when `id` is omitted. */
  destructive?: boolean
}

/**
 * UX-15.4 Phase 3 — the one shared overflow-menu renderer, replacing the
 * hand-rolled `<DropdownMenu><DropdownMenuItem>…</DropdownMenu>` block
 * every card (NoteCard/ImageCard/ConversationList/DocumentCard) used to
 * write out independently. Pure consolidation: callers still compute
 * their own `ResolvedAction[]` from their own already-existing mutation
 * hooks and permission checks (`canEdit`/`canDelete`) — this component
 * only owns the menu shell and per-item styling, so behavior/labels/
 * gating are byte-for-byte what each card already had.
 */
export function ActionMenu({ actions, trigger }: { actions: ResolvedAction[]; trigger?: ReactNode }) {
  if (actions.length === 0) return null

  return (
    <DropdownMenu trigger={trigger ?? <span aria-hidden>⋯</span>}>
      {actions.map((action) => {
        const destructive = action.destructive ?? (action.id ? getActionDefinition(action.id).destructive : false)
        const key = action.id ?? action.label
        if (action.href) {
          return (
            <Link
              key={key}
              to={action.href}
              role="menuitem"
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-canvas)] ${
                destructive ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink)]'
              }`}
            >
              {action.label}
            </Link>
          )
        }
        return (
          <DropdownMenuItem key={key} danger={destructive} onClick={action.onSelect!}>
            {action.label}
          </DropdownMenuItem>
        )
      })}
    </DropdownMenu>
  )
}
