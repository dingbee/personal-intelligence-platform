/**
 * UX-14.2 Memory Evolution (Reinforcement) — bounded diminishing-return
 * confidence bump. Each confirmed repeat closes a fixed fraction of the
 * remaining distance to full confidence (1), so early reinforcements move
 * confidence meaningfully while later ones add progressively less — a
 * memory that keeps getting corroborated approaches, but by construction
 * never reaches, absolute certainty. 0.25 means the first reinforcement
 * from a mid confidence closes a quarter of the remaining gap, the second
 * closes a quarter of what's left after that, and so on.
 */
export const REINFORCEMENT_STEP = 0.25

/**
 * Pure. `baseConfidence` is whatever the memory's real confidence already
 * is — the caller decides what "real" means when none is stored yet (see
 * rememberMemoryCandidate.ts: a manually-authored memory with no prior
 * confidence takes the new candidate's own freshly-scored confidence as
 * the base, since that's genuine evidence from this reinforcement event,
 * never a fabricated backfill for memories that aren't being reinforced).
 * Clamped defensively even though the formula is asymptotic and can't
 * reach 1 on its own — floating-point rounding after many reinforcements
 * must never be allowed to nudge the result past the 0..1 bound the
 * database itself enforces.
 */
export function reinforceConfidence(baseConfidence: number): number {
  const bumped = baseConfidence + (1 - baseConfidence) * REINFORCEMENT_STEP
  return Math.max(0, Math.min(1, bumped))
}
