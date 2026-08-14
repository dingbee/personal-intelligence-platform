/**
 * Analysis Intelligence — deterministic comparative arithmetic, sibling
 * to data-intelligence/resultDerivatives.ts and following its exact
 * discipline: generic post-processing over already-computed numbers,
 * never touching dataset rows and never invoking an LLM. Per the
 * architecture audit §10, "if it can be computed the same way
 * regardless of the question's intent, it's Data Intelligence" — a
 * percentage-point difference between two already-verified numbers is
 * exactly that, so it lives here as plain arithmetic, not as reasoning.
 * Whether a given difference is *material* or *worth explaining* is
 * still Analysis Intelligence's synthesis step's job, never this file's.
 */

/** Difference in percentage points between two ratios/percentages already expressed on the same 0-100 (or 0-1) scale. Returns null if either input is null. */
export function percentagePointDifference(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null
  return a - b
}

/** (a - b) / |b| * 100 — how much larger/smaller a is than b, as a percentage of b. Null if either input is null or b is 0 (division is undefined, never reported as Infinity/NaN). */
export function relativePercentageDifference(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null
  return ((a - b) / Math.abs(b)) * 100
}

export interface RankedEntry<T> {
  entry: T
  value: number
  rank: number
  shareOfTotalPercent: number | null
}

/**
 * Ranks already-computed values descending and attaches each entry's
 * share of the total — the deterministic half of "top N drive Y% of
 * the total" style concentration reasoning. Ties share the same rank
 * (dense ranking), matching how a person would read a ranked list.
 */
export function rankByValue<T>(entries: { entry: T; value: number | null }[]): RankedEntry<T>[] {
  const withValues = entries.filter((e): e is { entry: T; value: number } => e.value !== null)
  const total = withValues.reduce((sum, e) => sum + e.value, 0)
  const sorted = [...withValues].sort((a, b) => b.value - a.value)

  let rank = 0
  let lastValue: number | null = null
  return sorted.map((e) => {
    if (e.value !== lastValue) {
      rank += 1
      lastValue = e.value
    }
    return { entry: e.entry, value: e.value, rank, shareOfTotalPercent: total === 0 ? null : (e.value / total) * 100 }
  })
}
