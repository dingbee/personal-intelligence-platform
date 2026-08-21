/**
 * Quick UX fix — the familiar overlapping-squares copy glyph, used
 * wherever an existing "Copy"/"Copy action" text button is upgraded to an
 * icon affordance (MessageBubble, ActionsPage, SelectionHighlightButton).
 * No icon library exists in this codebase yet (checked before adding
 * this) — a single small inline-SVG component, matching this file's own
 * Spinner.tsx precedent, is the minimal addition rather than pulling in a
 * dependency for one glyph. Uses `currentColor` so it inherits whatever
 * text color/hover state the surrounding button already applies — no new
 * color logic introduced.
 */
export function CopyIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="8" y="8" width="14" height="14" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}
