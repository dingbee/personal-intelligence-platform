/**
 * Research Intelligence — the per-step planning prompt, composed in
 * code rather than a database-editable PromptTemplate. Same precedent
 * as Data/Analysis Intelligence's own planner prompts: this is a
 * mechanism detail of runResearchInvestigation's internal step loop,
 * not the one customer-tunable capability this module exposes
 * (research-synthesis, see module.ts).
 *
 * The model never originates a source here — it only ever proposes a
 * search query (executed deterministically by gatherEvidence.ts) or, if
 * a structured dataset is available and not yet used this
 * investigation, a sub-question to hand to Analysis Intelligence
 * (executed deterministically by runAnalysisInvestigation). The
 * deterministic MAX_RESEARCH_STEPS ceiling (enforced in
 * runResearchInvestigation.ts) is the actual safety boundary; this
 * prompt's own stop instruction is a quality signal on top of it.
 */
export function buildResearchStepPlannerSystemPrompt(params: {
  question: string
  scope: string | null
  context: string | null
  stepIndex: number
  maxSteps: number
  priorSteps: { purpose: string; query: string; evidenceCount: number; observations: string[] }[]
  datasetAvailable: boolean
  datasetUsed: boolean
}): string {
  const { question, scope, context, stepIndex, maxSteps, priorSteps, datasetAvailable, datasetUsed } = params

  const priorStepsSummary =
    priorSteps.length === 0
      ? '(none yet — this is the first step)'
      : priorSteps
          .map(
            (s, i) =>
              `${i + 1}. Purpose: ${s.purpose} | Query: "${s.query}" | Evidence found: ${s.evidenceCount}` +
              (s.observations.length > 0 ? `\n   Observations: ${s.observations.join(' / ')}` : '\n   Observations: (none — this query found nothing usable)'),
          )
          .join('\n')

  const datasetOption =
    datasetAvailable && !datasetUsed
      ? '\n2. To quantify something using the structured dataset available for this research (Analysis Intelligence will run a real, bounded investigation and return verified findings — you never compute numbers yourself):\n' +
        '{ "action": "analyze_dataset", "purpose": "<why this is useful>", "subQuestion": "<a specific, self-contained analytical question for the dataset>" }\n'
      : ''

  const nextOptionNumber = datasetOption ? 3 : 2
  const declineOptionNumber = nextOptionNumber + 1

  return (
    'You are the step planner for a bounded, deterministic research investigation. You are on step ' +
    `${stepIndex} of at most ${maxSteps}. You never search or read anything yourself — you only ever propose ` +
    'the next action; a deterministic system executes it and reports back exactly what it found before your next turn. ' +
    'You must never claim a source, quotation, statistic, or finding that was not actually returned to you in "Observations so far" below.\n\n' +
    `Research question: ${question}\n` +
    `Scope: ${scope ?? '(not specified)'}\n` +
    `Context: ${context ?? '(not specified)'}\n\n` +
    `Steps so far:\n${priorStepsSummary}\n\n` +
    'Respond with ONLY one of these JSON shapes (no markdown code fences, no other text):\n\n' +
    '1. To search the researcher\'s own library (documents, notes, and analyzed images) for relevant evidence:\n' +
    '{ "action": "search", "purpose": "<short reason, e.g. \'baseline evidence\' or \'follow-up: methodology details\'>", "query": "<a focused search query — a few keywords or a short phrase, not the whole question verbatim>" }\n' +
    datasetOption +
    `${nextOptionNumber}. To stop because enough evidence has been gathered, or because further searching is unlikely to add anything new:\n` +
    '{ "stop": true, "reason": "<one clear sentence>" }\n\n' +
    `${declineOptionNumber}. To decline because the question cannot be researched at all with what is available (only appropriate on step 1):\n` +
    '{ "error": "<one clear sentence explaining what is missing>" }\n\n' +
    'Rules: prefer a query that has not already been tried above. If a prior query found no usable evidence, do not repeat it verbatim — narrow, broaden, or try a different angle instead. ' +
    'If this is the first step, propose a clear initial search, never a stop or a decline unless the question is genuinely unresearchable from a personal knowledge library ' +
    '(e.g. it asks about live/real-time external events this system has no way to look up).'
  )
}
