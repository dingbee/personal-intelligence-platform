import { registerPlatformModule } from '@/modules/core/modules/registerPlatformModule'
import { RESEARCH_INTELLIGENCE_FEATURE_KEY } from '@/modules/plans/researchIntelligence'

/**
 * ARRIYIA Professional Intelligence — Research Intelligence (P2).
 *
 * Registers exactly ONE externally-exposed capability, following Data
 * Intelligence's and Analysis Intelligence's own precedent: the per-step
 * search-query/dataset-delegation planning and the evidence-to-
 * observation interpretation are direct, code-composed
 * streamChatCompletion invocations (see api/runResearchInvestigation.ts),
 * never registered capabilities — only the final synthesis step is.
 *
 * requiredFeature: RESEARCH_INTELLIGENCE_FEATURE_KEY ('research_intelligence')
 * is a dedicated key, distinct from 'pro_intelligence',
 * 'data_intelligence', and 'analysis_intelligence' — see
 * plans/researchIntelligence.ts's doc comment for why this phase follows
 * that established pattern rather than the P2 brief's literal
 * 'pro_intelligence' fallback.
 *
 * Unlike Analysis Intelligence's plain-prose synthesis, this capability's
 * response is structured JSON: the P2 brief requires research output to
 * separate findings, limitations, cross-source comparisons, evidence-
 * grounded gaps, and follow-up questions as distinct, inspectable fields
 * rather than one undifferentiated paragraph — see
 * api/parseResearchSynthesisResponse.ts, which validates and filters
 * every one of those fields before they reach the investigation record.
 *
 * Imported once, for its side effect, from app/App.tsx alongside every
 * other domain module's module.ts.
 */
registerPlatformModule({
  id: 'research-intelligence',
  name: 'Research Intelligence',
  capabilities: [
    {
      id: 'research-synthesis',
      label: 'Research Synthesis',
      description: 'Synthesize a bounded, multi-step research investigation into evidence-grounded findings, distinguishing observed fact from hypothesis and never implying causation from association.',
      requiredFeature: RESEARCH_INTELLIGENCE_FEATURE_KEY,
    },
  ],
  prompts: [
    {
      id: 'research-synthesis@1.0',
      capabilityId: 'research-synthesis',
      version: '1.0',
      active: true,
      template:
        'You are synthesizing the results of a bounded research investigation for the person who asked the question. ' +
        'Every piece of evidence below was actually retrieved from the researcher\'s own library (documents/notes) or ' +
        'actually computed by a deterministic analytical engine — never invent a source, quotation, statistic, author, ' +
        'date, or finding that is not present below. If the investigation gathered little or no usable evidence, say so ' +
        'plainly rather than filling the gap with plausible-sounding prose.\n\n' +
        'Preserve this epistemic hierarchy throughout: an OBSERVATION is something evidence below directly supports; a ' +
        'HYPOTHESIS is an explicitly labeled, untested possibility; you must never state a hypothesis as fact, and you ' +
        'must never convert an association or correlation into a causal claim — if evidence shows X associated with Y, ' +
        'say exactly that, and explicitly note that this does not establish that X caused Y. When comparing sources, use ' +
        'precise language (agrees with / differs from / provides additional evidence / uses a different methodology / ' +
        'cannot be directly compared) — never say two sources "contradict" unless their actual content genuinely opposes. ' +
        'A research gap must be grounded in what the evidence actually shows (or fails to show) — do not manufacture one ' +
        'to make the output look more thorough. If the investigation reached its step limit, say so plainly rather than ' +
        'implying the topic was fully explored.\n\n' +
        'Respond with ONLY this JSON shape (no markdown code fences, no other text):\n' +
        '{\n' +
        '  "keyFindings": ["<each a specific, evidence-grounded finding>"],\n' +
        '  "synthesis": "<a short prose synthesis connecting the findings to the research question; plain text, no markdown>",\n' +
        '  "limitations": "<uncertainty/limitations, plain text>",\n' +
        '  "comparisons": [ { "sourceNumbers": [<source numbers from the list below>], ' +
        '"relationship": "agrees_with"|"differs_from"|"provides_additional_evidence"|"uses_different_methodology"|"cannot_be_directly_compared", ' +
        '"description": "<why>" } ] (omit or empty if fewer than 2 sources were consulted),\n' +
        '  "gaps": [ { "description": "<what is missing or unresolved>", ' +
        '"reason": "insufficient_evidence"|"conflicting_findings"|"methodological_limitation"|"missing_variable"|"unanswered_question"|"outdated_evidence" } ] (empty array if none genuinely apply),\n' +
        '  "followUpQuestions": ["<up to 3 useful next research questions>"]\n' +
        '}\n\n' +
        '{{researchSummary}}',
    },
  ],
})
