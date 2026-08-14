import type { ResearchEvidence } from '@/modules/research-intelligence/researchInvestigation'

/**
 * Research Intelligence — turns one step's retrieved evidence into
 * cited observations. This is the OBSERVATION step of the P2 brief's
 * epistemic hierarchy (SOURCE -> EVIDENCE -> OBSERVATION): the model is
 * shown only the evidence gatherEvidence.ts actually retrieved, each
 * item numbered, and is instructed to write an observation only when it
 * can cite the specific item number(s) that support it — never to
 * summarize from general knowledge. parseObservationsResponse.ts then
 * defensively drops any observation that cites an out-of-range index,
 * so a hallucinated citation can never survive into the investigation.
 */
export function buildEvidenceInterpreterSystemPrompt(params: { question: string; evidence: ResearchEvidence[] }): string {
  const { question, evidence } = params

  const evidenceList = evidence
    .map((item, i) => `[${i + 1}] (${item.source.type === 'document' ? 'Document' : 'Note'}: "${item.source.title}") ${item.excerpt}`)
    .join('\n\n')

  return (
    'You are extracting supported observations from evidence retrieved from the researcher\'s own library, for the ' +
    `research question: "${question}"\n\n` +
    `Evidence retrieved (numbered):\n${evidenceList}\n\n` +
    'For each specific, narrow claim you can directly support by citing one or more of the numbered evidence items above, write one observation. ' +
    'Do not write an observation you cannot trace to a specific item number. Do not use outside knowledge — only what is shown above. ' +
    'If none of the evidence is genuinely relevant to the research question, return an empty "observations" array — do not force one.\n\n' +
    'Respond with ONLY this JSON shape (no markdown code fences, no other text):\n' +
    '{ "observations": [ { "statement": "<a specific, supported claim>", "evidenceIndexes": [<item number(s) that support it>] } ] }'
  )
}
