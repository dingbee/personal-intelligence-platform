import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'
import { DATA_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/dataIntelligence'

/**
 * ARRIYIA Professional Intelligence — Data Intelligence Foundation.
 *
 * Registers exactly ONE externally-exposed capability. The internal flow
 * ("question → analytical plan → deterministic execution → validation/
 * provenance → interpretation") has an internal planning step too, but
 * that step is a code-composed prompt called directly through
 * streamChatCompletion (see api/runDataIntelligenceQuery.ts and
 * api/buildPlannerSystemPrompt.ts's doc comment) — the same precedent
 * AIService's own chat system prompt already uses for a code-composed,
 * non-registry prompt. Deliberately NOT following the knowledge-
 * intelligence module's multi-capability-chain pattern (extract-concepts
 * → extract-entities → detect-relationships) here: Data Intelligence is
 * one product capability with internal machinery, not a chain of
 * separately-exposed capabilities.
 *
 * requiredFeature: DATA_INTELLIGENCE_FEATURE_KEY ('data_intelligence') is
 * a dedicated key, distinct from 'pro_intelligence' — see
 * plans/dataIntelligence.ts's doc comment for why.
 *
 * Imported once, for its side effect, from app/App.tsx alongside every
 * other domain module's module.ts.
 */
registerPlatformModule({
  id: 'data-intelligence',
  name: 'Data Intelligence',
  capabilities: [
    {
      id: 'data-intelligence-query',
      label: 'Data Intelligence Query',
      description: 'Answer a question about an uploaded structured dataset (spreadsheet) using a deterministically computed, validated result.',
      requiredFeature: DATA_INTELLIGENCE_FEATURE_KEY,
    },
  ],
  prompts: [
    {
      id: 'data-intelligence-query@1.0',
      capabilityId: 'data-intelligence-query',
      version: '1.0',
      active: true,
      template:
        'You are answering a question about a dataset for the person who uploaded it. A deterministic engine ' +
        'has already computed the exact result below — do not recompute, re-derive, second-guess, or adjust ' +
        'any number in it; treat it as ground truth. Your job is only to explain it in clear prose that ' +
        'directly answers the question. If the result says an error occurred or no rows matched, say so ' +
        'plainly rather than guessing an answer. If the computed numbers alone cannot support a causal or ' +
        'interpretive conclusion (e.g. "why" something happened), give the numbers and explicitly say what ' +
        'they do not establish. Do not invent facts, sources, or context not present below. No markdown, no ' +
        'headings, plain short paragraphs.\n\n' +
        'Question: {{question}}\n\nComputed result:\n{{resultSummary}}',
    },
  ],
})
