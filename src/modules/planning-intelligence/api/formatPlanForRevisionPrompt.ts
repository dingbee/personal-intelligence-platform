import type { Plan } from '@/modules/planning-intelligence/plan'

/**
 * Renders the CURRENT plan plus a described change into the
 * `{{revisionSummary}}` variable the planning-revise-plan prompt
 * template injects. Every milestone/task/workstream/resource is listed
 * with its REAL existing id shown as the value to reuse as "localId" —
 * this is the one thing that makes revision genuinely preserve
 * unaffected work rather than regenerate a lookalike plan from scratch
 * (see parseRevisedPlanningResponse.ts's own doc comment for how that id
 * gets honored on the way back in).
 */
export function formatPlanForRevisionPrompt(plan: Plan, change: string): string {
  const parts: string[] = [`Objective: ${plan.objective}`, `Requested change: ${change}`]

  parts.push(
    plan.workstreams.length > 0
      ? `Existing workstreams (reuse the exact id shown as "localId" for anything unaffected):\n${plan.workstreams.map((w) => `- id=${w.id} title="${w.title}" — ${w.description}`).join('\n')}`
      : 'Existing workstreams: (none)',
  )

  parts.push(
    plan.resources.length > 0
      ? `Existing resources (reuse the exact id shown as "localId" for anything unaffected):\n${plan.resources.map((r) => `- id=${r.id} name="${r.name}" kind=${r.kind} capacity=${r.capacity ?? 'unknown'}${r.unit ? ` ${r.unit}` : ''}`).join('\n')}`
      : 'Existing resources: (none)',
  )

  parts.push(
    plan.milestones.length > 0
      ? `Existing milestones (reuse the exact id shown as "localId" for anything unaffected):\n${[...plan.milestones]
          .sort((a, b) => a.sequence - b.sequence)
          .map((m) => `- id=${m.id} sequence=${m.sequence} title="${m.title}" target=${m.target ?? 'null'} targetDate=${m.targetDate ?? 'null'} dependsOn=[${m.dependsOnMilestoneIds.join(', ')}] — ${m.description}`)
          .join('\n')}`
      : 'Existing milestones: (none)',
  )

  parts.push(
    plan.tasks.length > 0
      ? `Existing tasks (reuse the exact id shown as "localId" for anything unaffected — this also PRESERVES that task's real current progress status, which you never state or change directly):\n${[...plan.tasks]
          .sort((a, b) => a.sequence - b.sequence)
          .map(
            (t) =>
              `- id=${t.id} sequence=${t.sequence} title="${t.title}" status=${t.status} priority=${t.priority} milestoneId=${t.milestoneId ?? 'null'} workstreamId=${t.workstreamId ?? 'null'} dependsOn=[${t.dependsOnTaskIds.join(', ')}] — ${t.description}`,
          )
          .join('\n')}`
      : 'Existing tasks: (none)',
  )

  parts.push(
    plan.constraints.length > 0
      ? `Existing constraints:\n${plan.constraints.map((c) => `- (${c.severity}, ${c.type}) ${c.constraint}`).join('\n')}`
      : 'Existing constraints: (none)',
  )

  if (plan.deadline) parts.push(`Existing plan deadline: ${plan.deadline}`)

  parts.push(
    plan.risks.length > 0
      ? `Existing risks:\n${plan.risks.map((r) => `- ${r.risk} (impact: ${r.impact}${r.probability ? `, probability: ${r.probability}` : ''})${r.mitigation ? ` mitigation: ${r.mitigation}` : ''}${r.contingency ? ` contingency: ${r.contingency}` : ''}`).join('\n')}`
      : 'Existing risks: (none)',
  )

  parts.push(
    plan.decisions.length > 0
      ? `Existing decisions:\n${plan.decisions.map((d) => `- ${d.decision}${d.unresolved ? ' (unresolved)' : ''}${d.decisionIntelligence?.recommendedAlternativeId ? ` — already resolved via analysis` : d.recommendation ? ` — proposed: ${d.recommendation}` : ''}`).join('\n')}`
      : 'Existing decisions: (none)',
  )

  return parts.join('\n\n')
}
