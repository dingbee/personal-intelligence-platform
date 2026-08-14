/**
 * Analysis Intelligence — the per-step planning prompt, composed in
 * code rather than a database-editable PromptTemplate. Same precedent
 * and same reasoning as Data Intelligence's buildPlannerSystemPrompt.ts:
 * this is a mechanism detail of runAnalysisInvestigation's internal
 * step loop, not the one customer-tunable capability this module
 * exposes (analysis-investigation-synthesis, see module.ts) — that
 * capability is the synthesis step, whose tone an admin might
 * reasonably want to adjust; the strict JSON contract enforced here is
 * not.
 *
 * Unlike Data Intelligence's single-shot planner, this prompt also asks
 * the model to decide whether investigating further is worthwhile at
 * all — the model can respond with a plan, a decision to stop, or a
 * decline (question can't be investigated from this schema). The
 * deterministic step-count ceiling (MAX_INVESTIGATION_STEPS, enforced
 * in runAnalysisInvestigation.ts) is the actual safety boundary; this
 * prompt's own stop instruction is a quality signal on top of it, never
 * a substitute for it.
 */
export function buildStepPlannerSystemPrompt(params: {
  schemaDescription: string
  question: string
  stepIndex: number
  maxSteps: number
  priorObservations: string[]
  investigatedDimensions: string[]
}): string {
  const { schemaDescription, question, stepIndex, maxSteps, priorObservations, investigatedDimensions } = params

  const priorContext =
    priorObservations.length === 0
      ? '(none yet — this is the first step)'
      : priorObservations.map((o, i) => `${i + 1}. ${o}`).join('\n')

  const alreadyInvestigated = investigatedDimensions.length === 0 ? '(none yet)' : investigatedDimensions.join(', ')

  return (
    'You are the step planner for a bounded, deterministic analytical investigation. You are on step ' +
    `${stepIndex} of at most ${maxSteps}. Given the original question, the dataset schema, and what has already ` +
    'been observed, decide either (a) the next single AnalyticalPlan worth computing, or (b) that no further ' +
    'step would add useful evidence and the investigation should stop. You never see the data\'s actual rows — ' +
    'only the schema and the observations already computed by the deterministic engine below.\n\n' +
    `${schemaDescription}\n\n` +
    `Original question: ${question}\n\n` +
    `Observations so far:\n${priorContext}\n\n` +
    `Dimensions already broken down by in this investigation: ${alreadyInvestigated}\n\n` +
    'Respond with ONLY one of these three JSON shapes (no markdown code fences, no other text):\n\n' +
    '1. To propose the next step:\n' +
    '{\n' +
    '  "purpose": "<short reason this step is useful, e.g. \'baseline\' or \'follow-up: breakdown by Product\'>",\n' +
    '  "hypothesis": "<optional — a possible explanation this step tests, or omit if none>",\n' +
    '  "plan": {\n' +
    '    "filters": [ { "column": "<exact column name>", "op": "eq"|"neq"|"gt"|"gte"|"lt"|"lte"|"in"|"between", "value": <value> } ],\n' +
    '    "dimensions": [ { "column": "<exact column name>", "dateTrunc": "year"|"month" (optional, date columns only) } ],\n' +
    '    "measures": [ { "as": "<short output name>", "aggregation": "sum"|"avg"|"count"|"count_distinct"|"min"|"max"|"ratio", ' +
    '"column": "<optional, required for sum/avg/min/max/count_distinct>", "filters": [...optional...], ' +
    '"ratio": { "numerator": {...}, "denominator": {...} } (required only for aggregation:"ratio") } ],\n' +
    '    "sort": { "by": "<dimension column or measure \'as\'>", "direction": "asc"|"desc" } (optional),\n' +
    '    "limit": <number> (optional)\n' +
    '  }\n' +
    '}\n\n' +
    '2. To stop the investigation because enough has been established or no further breakdown would help:\n' +
    '{ "stop": true, "reason": "<one clear sentence>" }\n\n' +
    '3. To decline because the question cannot be investigated at all from this schema:\n' +
    '{ "error": "<one clear sentence explaining what is missing>" }\n\n' +
    'Rules: use only column names that appear in the schema, exactly as spelled. Prefer a dimension not already ' +
    'listed as "already broken down by" above — do not repeat the same breakdown. Prefer breakdowns by columns ' +
    'that plausibly bear on the question. A ratio measure (e.g. a rate) always uses "ratio" with both numerator ' +
    'and denominator — never a plain sum/avg pretending to already be a rate. If this is the first step, propose ' +
    'a clear baseline computation for the question, never a stop.'
  )
}
