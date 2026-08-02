/**
 * UX-14.5 Phase 5 — the one place that turns a member's display name/
 * email into the two letters an avatar shows. Pure so it's directly
 * testable, matching this codebase's convention for small display-logic
 * helpers (formatRelativeTime, mergeNotes' pure functions).
 */
export function getInitials(displayName: string | null, email: string): string {
  const source = (displayName ?? '').trim() || email
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}
