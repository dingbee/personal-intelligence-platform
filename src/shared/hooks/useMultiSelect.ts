import { useState } from 'react'

/**
 * UX-15.4 Phase 4 — the one selection-mode state shape, extracted from
 * what `NotesPage`'s own "Merge notes" mode already implemented by hand
 * (`selectionMode`/`selectedIds`/`toggleSelected`/`exitSelectionMode`).
 * Generalizes it so any list page (Notes, Documents, …) can offer a
 * multi-select action bar without re-deriving this same `Set<string>`
 * toggle logic — the bulk operations themselves still call each
 * object's own existing single-item mutation in a loop (`Promise.all`),
 * never a new batch endpoint.
 */
export function useMultiSelect() {
  const [active, setActive] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  function enable() {
    setActive(true)
  }

  function disable() {
    setActive(false)
    setSelectedIds(new Set())
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clear() {
    setSelectedIds(new Set())
  }

  return { active, selectedIds, enable, disable, toggle, clear }
}
