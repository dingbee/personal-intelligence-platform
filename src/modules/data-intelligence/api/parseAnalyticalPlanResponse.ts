import type { AnalyticalPlan } from '@/modules/data-intelligence/analyticalPlan'

export type PlanParseResult =
  | { status: 'ok'; plan: AnalyticalPlan }
  /** The planner explicitly said the question can't be turned into a plan (missing data, ambiguous) — epistemic cases C/D, not a bug. */
  | { status: 'declined'; reason: string }
  /** The response wasn't valid JSON, or didn't match the expected shape at all — a parse failure, distinct from a deliberate decline. */
  | { status: 'invalid'; reason: string }

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1]!.trim() : trimmed
}

/**
 * Data Intelligence Foundation — parses the planner call's raw text
 * output into a structured PlanParseResult. Deliberately conservative:
 * only checks the outer shape is plausible (an object with a `measures`
 * array, or an explicit `{"error": "..."}` decline) — column names,
 * aggregation enum values, and type compatibility are all re-checked by
 * executeAnalyticalPlan's own validation against the real dataset, the
 * one place that matters for correctness. This function's job is only to
 * turn "the model didn't say anything usable" into a clean `invalid`
 * result instead of a crash.
 */
export function parseAnalyticalPlanResponse(rawText: string, datasetId: string): PlanParseResult {
  const text = stripCodeFences(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { status: 'invalid', reason: 'The planner did not return valid JSON.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { status: 'invalid', reason: 'The planner response was not a JSON object.' }
  }

  const obj = parsed as Record<string, unknown>

  if (typeof obj.error === 'string') {
    return { status: 'declined', reason: obj.error }
  }

  if (!Array.isArray(obj.measures) || obj.measures.length === 0) {
    return { status: 'invalid', reason: 'The planner response had no "measures" array.' }
  }

  const plan: AnalyticalPlan = {
    datasetId,
    filters: Array.isArray(obj.filters) ? (obj.filters as AnalyticalPlan['filters']) : undefined,
    dimensions: Array.isArray(obj.dimensions) ? (obj.dimensions as AnalyticalPlan['dimensions']) : undefined,
    measures: obj.measures as AnalyticalPlan['measures'],
    sort: obj.sort && typeof obj.sort === 'object' ? (obj.sort as AnalyticalPlan['sort']) : undefined,
    limit: typeof obj.limit === 'number' ? obj.limit : undefined,
  }

  return { status: 'ok', plan }
}
