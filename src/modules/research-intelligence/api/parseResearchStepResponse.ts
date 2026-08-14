export type StepParseResult =
  | { status: 'search'; purpose: string; query: string }
  | { status: 'analyze_dataset'; purpose: string; subQuestion: string }
  /** The planner decided enough evidence has been gathered — a normal, honest stop, not a failure. */
  | { status: 'stop'; reason: string }
  /** The planner decided the question can't be researched at all from what's available — an honest decline, not a bug. */
  | { status: 'declined'; reason: string }
  /** The response wasn't valid JSON or didn't match any expected shape — a parse failure. */
  | { status: 'invalid'; reason: string }

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1]!.trim() : trimmed
}

/**
 * Research Intelligence — parses one step-planner call's raw text.
 * Same conservative philosophy as Analysis Intelligence's
 * parseAnalysisStepResponse.ts: only checks the outer shape is
 * plausible and that string fields are genuinely non-empty strings —
 * there is no further "validation" step here because, unlike an
 * AnalyticalPlan, a search query or sub-question has no schema to
 * validate against ahead of time; gatherEvidence/runAnalysisInvestigation
 * simply run with whatever was proposed and report back what actually
 * happened.
 */
export function parseResearchStepResponse(rawText: string): StepParseResult {
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
    return { status: 'stop', reason: typeof obj.reason === 'string' ? obj.reason : 'No further useful evidence-gathering step identified.' }
  }
  if (typeof obj.error === 'string') {
    return { status: 'declined', reason: obj.error }
  }

  if (obj.action === 'search') {
    if (typeof obj.query !== 'string' || !obj.query.trim()) {
      return { status: 'invalid', reason: 'The step planner proposed a search with no "query".' }
    }
    return { status: 'search', purpose: typeof obj.purpose === 'string' && obj.purpose.trim() ? obj.purpose.trim() : 'evidence gathering', query: obj.query.trim() }
  }

  if (obj.action === 'analyze_dataset') {
    if (typeof obj.subQuestion !== 'string' || !obj.subQuestion.trim()) {
      return { status: 'invalid', reason: 'The step planner proposed a dataset analysis with no "subQuestion".' }
    }
    return {
      status: 'analyze_dataset',
      purpose: typeof obj.purpose === 'string' && obj.purpose.trim() ? obj.purpose.trim() : 'quantify via the available dataset',
      subQuestion: obj.subQuestion.trim(),
    }
  }

  return { status: 'invalid', reason: 'The step planner response had no recognized "action", "stop", or "error".' }
}
