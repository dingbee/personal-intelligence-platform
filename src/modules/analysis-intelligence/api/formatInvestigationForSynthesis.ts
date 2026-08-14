import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'

/**
 * Analysis Intelligence — turns an in-progress-to-complete
 * AnalysisInvestigation into the plain-text block the synthesis
 * capability's prompt is grounded in. This is the only thing the
 * synthesis call ever sees about the investigation — it never receives
 * raw dataset rows or raw AnalyticalResult objects, only the already-
 * extracted Observation statements, exactly the same "LLM never
 * touches the numbers" discipline Data Intelligence's own
 * formatAnalyticalResultForInterpretation.ts established at single-
 * result scale, held here across every step.
 */
export function formatInvestigationForSynthesis(investigation: AnalysisInvestigation): string {
  const stepBlocks = investigation.steps.map((step) => {
    if (step.result.status === 'error') {
      return `Step ${step.index + 1} (${step.purpose}) — FAILED: ${step.result.error.message}. No evidence from this step.`
    }
    const obs = step.observations.map((o) => `  - ${o.statement}`).join('\n')
    return `Step ${step.index + 1} (${step.purpose}):\n${obs || '  (no rows)'}`
  })

  const hypothesesBlock =
    investigation.hypotheses.length === 0
      ? 'None proposed.'
      : investigation.hypotheses.map((h) => `- ${h.statement} [${h.status}]`).join('\n')

  const contradictionsBlock =
    investigation.contradictions.length === 0
      ? 'None detected.'
      : investigation.contradictions.map((c) => `- ${c.description}`).join('\n')

  const limitNote = investigation.stepLimitReached
    ? '\n\nNOTE: The investigation reached its maximum step limit before the planner chose to stop naturally. State plainly that investigation depth was limited — do not imply the topic was fully explored.'
    : ''

  return (
    `Original question: ${investigation.question}\n\n` +
    `Investigation steps:\n${stepBlocks.join('\n\n')}\n\n` +
    `Hypotheses proposed during investigation (untested unless marked otherwise):\n${hypothesesBlock}\n\n` +
    `Tensions between findings (not resolved, not assumed to explain each other):\n${contradictionsBlock}` +
    limitNote
  )
}
