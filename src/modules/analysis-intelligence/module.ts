import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'
import { ANALYSIS_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/analysisIntelligence'

/**
 * ARRIYIA Professional Intelligence — Analysis Intelligence.
 *
 * Registers exactly ONE externally-exposed capability, following Data
 * Intelligence's own precedent (see data-intelligence/module.ts's doc
 * comment) rather than the knowledge-intelligence module's multi-
 * capability-chain pattern: the per-step planning calls are direct,
 * code-composed streamChatCompletion invocations (see
 * api/buildStepPlannerSystemPrompt.ts and api/runAnalysisInvestigation.ts),
 * never registered capabilities — only the final synthesis step is.
 *
 * requiredFeature: ANALYSIS_INTELLIGENCE_FEATURE_KEY ('analysis_intelligence')
 * is a dedicated key, distinct from both 'pro_intelligence' and
 * 'data_intelligence' — see plans/analysisIntelligence.ts's doc comment.
 *
 * Imported once, for its side effect, from app/App.tsx alongside every
 * other domain module's module.ts.
 */
registerPlatformModule({
  id: 'analysis-intelligence',
  name: 'Analysis Intelligence',
  capabilities: [
    {
      id: 'analysis-investigation-synthesis',
      label: 'Analysis Investigation Synthesis',
      description: 'Synthesize a bounded, multi-step analytical investigation into evidence-grounded findings, distinguishing verified observations from hypotheses.',
      requiredFeature: ANALYSIS_INTELLIGENCE_FEATURE_KEY,
    },
  ],
  prompts: [
    {
      id: 'analysis-investigation-synthesis@1.0',
      capabilityId: 'analysis-investigation-synthesis',
      version: '1.0',
      active: true,
      template:
        'You are synthesizing the results of a bounded analytical investigation for the person who asked the ' +
        'question. A deterministic engine has already computed every number in the investigation summary below — ' +
        'do not recompute, re-derive, second-guess, or adjust any of them; treat them as ground truth. Your job ' +
        'is to write a clear, evidence-grounded synthesis covering, in order: (1) key findings, each one ' +
        'explicitly tied to the step that established it, (2) important patterns across the findings, (3) ' +
        'uncertainty and limitations — including anything a failed step or the step limit prevented you from ' +
        'establishing, (4) alternative explanations where the evidence genuinely supports more than one reading, ' +
        'and (5) 1-3 recommended follow-up analytical questions.\n\n' +
        'Strict epistemic discipline: only state as fact what an investigation step actually computed. A ' +
        'hypothesis listed as [untested] must be presented as an untested possibility, never as an established ' +
        'finding. If two findings show a tension (see "Tensions" below), say so plainly rather than resolving it ' +
        'for the reader. Never convert an association or correlation into a causal claim — if orders with X show ' +
        'a higher rate of Y, say exactly that, and explicitly state that this does not establish that X caused Y. ' +
        'If the investigation reached its step limit, say so plainly rather than implying the topic was fully ' +
        'explored. Do not invent facts, sources, or context not present below. No markdown, no headings, plain ' +
        'short paragraphs.\n\n' +
        '{{investigationSummary}}',
    },
  ],
})
