import type { LearningSignal } from '@/modules/learning-intelligence/learning'

/**
 * I8.22 — no persisted STALE status: a signal's own status enum
 * (proposed/active/contested/revoked) stays the real, server-enforced
 * lifecycle; staleness is a purely presentational, always-current
 * computation over `lastEvidenceAt` (there is no background job in this
 * codebase to periodically flip a stored flag, and a computed value can
 * never drift out of date the way a cached one could). An 'active'
 * signal with no NEW corroborating evidence in a long time is still
 * literally true of the evidence it has — it just deserves a visible
 * "hasn't been re-confirmed lately" hint before someone leans on it,
 * which this function exists to compute.
 */
const STALE_AFTER_DAYS = 90

export function isSignalStale(signal: LearningSignal, now: Date = new Date()): boolean {
  if (signal.status === 'revoked') return false
  const daysSinceLastEvidence = (now.getTime() - new Date(signal.lastEvidenceAt).getTime()) / (1000 * 60 * 60 * 24)
  return daysSinceLastEvidence >= STALE_AFTER_DAYS
}
