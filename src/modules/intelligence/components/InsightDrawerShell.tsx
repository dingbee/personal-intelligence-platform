import { useState, type ReactNode } from 'react'

export type DrawerState = 'collapsed' | 'expanded' | 'minimized' | 'fullscreen'

function readStoredState(storageKey: string): DrawerState {
  const stored = localStorage.getItem(storageKey)
  return stored === 'expanded' || stored === 'collapsed' || stored === 'minimized' ? stored : 'collapsed'
}

export interface InsightDrawerShellProps {
  /** localStorage key this instance's collapsed/expanded/minimized preference persists under — give every mounted drawer its own key. */
  storageKey: string
  label: string
  icon?: string
  children: ReactNode
}

/**
 * UX-13.10.2 — the collapsed/expanded/minimized/fullscreen chrome +
 * localStorage persistence NovaInsightDrawer (UX-13.5D/13.6) established
 * for the main Chat page, extracted so every "intelligence metadata under
 * a chat message" surface shares one behavior instead of each reinventing
 * collapse/minimize/maximize. A caller owns its own body content entirely
 * (passed as `children`) and hands over only a label/icon/storage key —
 * this owns the interaction chrome and nothing about what's inside it.
 */
export function InsightDrawerShell({ storageKey, label, icon = '✨', children }: InsightDrawerShellProps) {
  const [state, setState] = useState<DrawerState>(() => readStoredState(storageKey))

  function setPersistedState(next: DrawerState) {
    setState(next)
    if (next === 'fullscreen') return // fullscreen is a transient view, not a persisted preference
    localStorage.setItem(storageKey, next)
  }

  function toggleBody() {
    if (state === 'fullscreen') {
      setPersistedState('expanded')
      return
    }
    setPersistedState(state === 'collapsed' ? 'expanded' : 'collapsed')
  }

  const header = (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={toggleBody}
        className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)] transition-colors hover:text-[var(--color-accent)]"
        aria-expanded={state === 'expanded' || state === 'fullscreen'}
      >
        <span aria-hidden className={`inline-block transition-transform duration-200 ${state === 'collapsed' ? '' : 'rotate-90'}`}>
          ▸
        </span>
        <span aria-hidden>{icon}</span> {label}
      </button>
      {state !== 'collapsed' && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPersistedState('minimized')}
            aria-label={`Minimize ${label} panel`}
            className="text-xs text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            ─ Minimize
          </button>
          <button
            type="button"
            onClick={() => setPersistedState(state === 'fullscreen' ? 'expanded' : 'fullscreen')}
            aria-label={state === 'fullscreen' ? 'Exit fullscreen' : `Expand ${label} to fullscreen`}
            className="text-xs text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
          >
            {state === 'fullscreen' ? '⤡ Exit fullscreen' : '⤢ Maximize'}
          </button>
        </div>
      )}
    </div>
  )

  if (state === 'minimized') {
    return (
      <button
        type="button"
        onClick={() => setPersistedState('expanded')}
        aria-label={`Restore ${label} panel`}
        className="fixed bottom-24 right-6 z-20 flex items-center gap-1.5 rounded-pill border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] shadow-raised transition-colors hover:text-[var(--color-accent)] sm:bottom-6"
      >
        <span aria-hidden>{icon}</span> {label}
      </button>
    )
  }

  if (state === 'fullscreen') {
    return (
      <div className="fixed inset-0 z-20 flex flex-col overflow-y-auto bg-[var(--color-surface)] p-6">
        {header}
        <div className="mt-4">{children}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-6 py-3">
      {header}
      {/* grid-template-rows 0fr/1fr is the CSS-only way to animate a height
          that isn't known ahead of time, no measuring/JS required; the inner
          overflow-hidden clips content during the transition. The innermost
          max-h/overflow-y-auto caps how much of the message area an
          expanded drawer can claim — content scrolls inside the drawer
          instead of pushing the whole page. */}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${state === 'expanded' ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="max-h-[45vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  )
}
