import type { AnalysisStep, Contradiction } from '@/modules/analysis-intelligence/analysisInvestigation'

type TrendDirection = 'up' | 'down' | 'flat'

/**
 * Deterministic trend direction for one measure across an already-
 * chronologically-groupable step result (a single dateTrunc dimension).
 * Compares the first and last group's value only — a coarse but honest
 * signal, not a full regression; null when there's nothing to compare
 * (fewer than 2 usable values).
 */
function computeTrendDirection(step: AnalysisStep, dimensionColumn: string, measureKey: string): TrendDirection | null {
  if (step.result.status !== 'ok') return null
  const points = step.result.rows
    .map((row) => ({ period: row.dimensions[dimensionColumn], value: row.measures[measureKey] }))
    .filter((p): p is { period: string; value: number } => typeof p.period === 'string' && p.value !== null)
    .sort((a, b) => a.period.localeCompare(b.period))

  if (points.length < 2) return null
  const first = points[0]!.value
  const last = points[points.length - 1]!.value
  if (last === first) return 'flat'
  return last > first ? 'up' : 'down'
}

interface TrendEntry {
  stepId: string
  measureAs: string
  direction: TrendDirection
  representativeObservationId: string | null
}

/**
 * Analysis Intelligence — the ONE deterministic contradiction check this
 * phase implements (architecture audit §11): flags when two different
 * measures, each trending across the same kind of period breakdown
 * within one investigation, move in opposite directions — e.g. "total
 * sales rising while unit volume falls." This is a tension flag, not an
 * assertion of logical contradiction or a resolved explanation — the
 * synthesis prompt is responsible for saying "these findings appear
 * inconsistent," never this function. Deliberately does NOT attempt a
 * general pairwise-LLM contradiction comparator (confirmed, by the
 * architecture audit, to have been explicitly declined twice already at
 * the Knowledge Intelligence layer for cost/reliability reasons).
 */
export function detectOppositeDirectionTensions(steps: AnalysisStep[]): Contradiction[] {
  const entries: TrendEntry[] = []

  for (const step of steps) {
    if (step.result.status !== 'ok') continue
    const dimensions = step.plan.dimensions ?? []
    if (dimensions.length !== 1 || !dimensions[0]!.dateTrunc) continue

    const dimensionColumn = dimensions[0]!.column
    for (const measure of step.plan.measures) {
      const direction = computeTrendDirection(step, dimensionColumn, measure.as)
      if (direction === null || direction === 'flat') continue
      entries.push({
        stepId: step.id,
        measureAs: measure.as,
        direction,
        representativeObservationId: step.observations.length > 0 ? step.observations[step.observations.length - 1]!.id : null,
      })
    }
  }

  const contradictions: Contradiction[] = []
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!
      const b = entries[j]!
      if (a.measureAs === b.measureAs) continue
      if (a.direction === b.direction) continue
      if (!a.representativeObservationId || !b.representativeObservationId) continue

      contradictions.push({
        id: crypto.randomUUID(),
        observationIds: [a.representativeObservationId, b.representativeObservationId],
        description: `"${a.measureAs}" trended ${a.direction} while "${b.measureAs}" trended ${b.direction} over the same period breakdown — worth investigating together, not assumed to explain each other.`,
      })
    }
  }
  return contradictions
}
