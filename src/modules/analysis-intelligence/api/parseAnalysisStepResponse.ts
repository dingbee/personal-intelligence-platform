import type { AnalyticalPlan } from '@/modules/data-intelligence/analyticalPlan'

export type StepParseResult =
  | { status: 'plan'; plan: AnalyticalPlan; purpose: string; hypothesis: string | null }
  /** The planner decided no further step would add useful evidence — a normal, honest stop, not a failure. */
  | { status: 'stop'; reason: string }
  /** The planner decided the question can't be investigated at all from this schema — epistemic case C/D, not a bug. */
  | { status: 'declined'; reason: string }
  /** The response wasn't valid JSON or didn't match any of the three expected shapes — a parse failure. */
  | { status: 'invalid'; reason: string }

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1]!.trim() : trimmed
}

/**
 * Analysis Intelligence — parses one step-planner call's raw text into
 * a StepParseResult. Same conservative philosophy as Data Intelligence's
 * parseAnalyticalPlanResponse.ts: only checks the outer shape is
 * plausible; executeAnalyticalPlan's own validation (column existence,
 * type compatibility, ...) is the real check that matters once a plan
 * is actually proposed.
 */
export function parseAnalysisStepResponse(rawText: string, datasetId: string): StepParseResult {
  const text = stripCodeFences(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { status: 'invalid', reason: 'The step planner did not return valid JSON.' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { status: 'invalid', reason: 'The step planner response was not a JSON object.' }
  }
  const obj = parsed as Record<string, unknown>

  if (obj.stop === true) {
    return { status: 'stop', reason: typeof obj.reason === 'string' ? obj.reason : 'No further useful step identified.' }
  }
  if (typeof obj.error === 'string') {
    return { status: 'declined', reason: obj.error }
  }
  if (typeof obj.plan !== 'object' || obj.plan === null) {
    return { status: 'invalid', reason: 'The step planner response had no "plan", "stop", or "error".' }
  }

  const planObj = obj.plan as Record<string, unknown>
  if (!Array.isArray(planObj.measures) || planObj.measures.length === 0) {
    return { status: 'invalid', reason: 'The proposed plan had no "measures" array.' }
  }

  const plan: AnalyticalPlan = {
    datasetId,
    filters: Array.isArray(planObj.filters) ? (planObj.filters as AnalyticalPlan['filters']) : undefined,
    dimensions: Array.isArray(planObj.dimensions) ? (planObj.dimensions as AnalyticalPlan['dimensions']) : undefined,
    measures: planObj.measures as AnalyticalPlan['measures'],
    sort: planObj.sort && typeof planObj.sort === 'object' ? (planObj.sort as AnalyticalPlan['sort']) : undefined,
    limit: typeof planObj.limit === 'number' ? planObj.limit : undefined,
  }

  return {
    status: 'plan',
    plan,
    purpose: typeof obj.purpose === 'string' && obj.purpose.trim() ? obj.purpose.trim() : 'analytical step',
    hypothesis: typeof obj.hypothesis === 'string' && obj.hypothesis.trim() ? obj.hypothesis.trim() : null,
  }
}
