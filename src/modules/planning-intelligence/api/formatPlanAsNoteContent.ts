import type { Plan } from '@/modules/planning-intelligence/plan'

const ORIGIN_LABELS: Record<string, string> = { known: 'Known', assumed: 'Assumed', unknown: 'Unknown', requires_user_input: 'Requires your input' }

/** Renders a completed Plan as note content — mirrors formatResearchAsNoteContent.ts's own plain-text-with-headings convention. */
export function formatPlanAsNoteContent(plan: Plan): string {
  const lines: string[] = [`# ${plan.title}`, '', `Objective: ${plan.objective}`]

  if (plan.description) lines.push('', plan.description)
  if (plan.currentState) lines.push('', `Current state: ${plan.currentState}`)
  if (plan.desiredOutcome) lines.push('', `Desired outcome: ${plan.desiredOutcome}`)
  if (plan.gapAnalysis) lines.push('', `Gap analysis: ${plan.gapAnalysis}`)

  if (plan.milestones.length > 0) {
    lines.push('', '## Milestones')
    for (const m of [...plan.milestones].sort((a, b) => a.sequence - b.sequence)) {
      lines.push(`${m.sequence}. ${m.title}${m.target ? ` (target: ${m.target})` : ''} — ${m.description}`)
    }
  }

  if (plan.tasks.length > 0) {
    lines.push('', '## Tasks')
    for (const t of [...plan.tasks].sort((a, b) => a.sequence - b.sequence)) {
      const milestone = plan.milestones.find((m) => m.id === t.milestoneId)
      lines.push(`${t.sequence}. [${t.priority}] ${t.title}${milestone ? ` (${milestone.title})` : ''} — ${t.description}${t.estimatedEffort ? ` (est: ${t.estimatedEffort})` : ''}`)
    }
  }

  if (plan.assumptions.length > 0) {
    lines.push('', '## Assumptions')
    for (const a of plan.assumptions) lines.push(`- [${ORIGIN_LABELS[a.origin] ?? a.origin}] ${a.statement}`)
  }

  if (plan.constraints.length > 0) {
    lines.push('', '## Constraints')
    for (const c of plan.constraints) lines.push(`- (${c.severity}) ${c.constraint}`)
  }

  if (plan.risks.length > 0) {
    lines.push('', '## Risks')
    for (const r of plan.risks) lines.push(`- ${r.risk} (impact: ${r.impact}${r.probability ? `, probability: ${r.probability}` : ''})${r.mitigation ? ` — mitigation: ${r.mitigation}` : ''}`)
  }

  if (plan.decisions.length > 0) {
    lines.push('', '## Decisions needed')
    for (const d of plan.decisions) {
      lines.push(`- ${d.decision}${d.unresolved ? ' (unresolved)' : ''}${d.recommendation ? ` — recommendation: ${d.recommendation}` : ''}`)
    }
  }

  if (plan.outputs.length > 0) {
    lines.push('', '## Expected outputs')
    for (const o of plan.outputs) lines.push(`- ${o.deliverable} (done when: ${o.completionCriteria})`)
  }

  if (plan.successCriteria.length > 0) {
    lines.push('', '## Success criteria')
    for (const s of plan.successCriteria) lines.push(`- ${s}`)
  }

  return lines.join('\n')
}
