import type { Decision } from '@/modules/decision-intelligence/decision'

const ORIGIN_LABELS: Record<string, string> = { known: 'Known', assumed: 'Assumed', unknown: 'Unknown', requires_user_input: 'Requires your input' }

/** Renders a completed Decision as note content — mirrors formatPlanAsNoteContent.ts's own plain-text-with-headings convention. */
export function formatDecisionAsNoteContent(decision: Decision): string {
  const lines: string[] = [`# ${decision.title}`, '', `Question: ${decision.question}`]

  if (decision.objective) lines.push('', `Objective: ${decision.objective}`)

  const recommended = decision.alternatives.find((a) => a.id === decision.recommendedAlternativeId)
  if (recommended) {
    lines.push('', `## Recommendation: ${recommended.title}`, decision.rationale ?? '')
    lines.push(`Confidence: ${decision.confidence ?? 'unknown'}${decision.provisional ? ' (provisional)' : ''}`)
    if (decision.provisionalReason) lines.push(decision.provisionalReason)
  }

  if (decision.alternatives.length > 0) {
    lines.push('', '## Alternatives considered')
    for (const a of decision.alternatives) {
      const score = decision.weightedScores.find((s) => s.alternativeId === a.id)
      lines.push(`- ${a.title}${score ? ` (weighted score: ${score.totalScore.toFixed(2)})` : ''} — ${a.description}`)
    }
  }

  if (decision.criteria.length > 0) {
    lines.push('', '## Criteria')
    for (const c of decision.criteria) lines.push(`- ${c.name} (weight: ${c.weight}, ${c.importance}) — ${c.description}`)
  }

  if (decision.tradeoffs.length > 0) {
    lines.push('', '## Trade-offs')
    for (const t of decision.tradeoffs) lines.push(`- ${t}`)
  }

  if (decision.risks.length > 0) {
    lines.push('', '## Risks')
    for (const r of decision.risks) lines.push(`- ${r.description} (impact: ${r.impact}${r.likelihood ? `, likelihood: ${r.likelihood}` : ''})${r.mitigation ? ` — mitigation: ${r.mitigation}` : ''}`)
  }

  if (decision.assumptions.length > 0) {
    lines.push('', '## Assumptions')
    for (const a of decision.assumptions) lines.push(`- [${ORIGIN_LABELS[a.origin] ?? a.origin}] ${a.statement}`)
  }

  if (decision.unknowns.length > 0) {
    lines.push('', '## Unknowns')
    for (const u of decision.unknowns) lines.push(`- ${u}`)
  }

  if (decision.sensitivity.length > 0) {
    lines.push('', '## Sensitivity')
    for (const s of decision.sensitivity) lines.push(`- ${s.description}`)
  }

  if (decision.nextAction) lines.push('', `## Next action`, decision.nextAction)

  return lines.join('\n')
}
