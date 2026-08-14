import type { DecisionContext } from '@/modules/decision-intelligence/api/buildDecisionContext'

/** Renders the assembled DecisionContext into the `{{decisionSummary}}` variable the decision-generate-recommendation prompt template injects — plain text, mirroring formatPlanningContextForPrompt.ts's own convention. */
export function formatDecisionContextForPrompt(context: DecisionContext): string {
  const parts: string[] = [`Decision question: ${context.question}`]

  if (context.objective) parts.push(`Objective: ${context.objective}`)

  if (context.planContext) {
    const p = context.planContext
    parts.push(
      `This decision is being made in service of an existing plan, "${p.planTitle}" (objective: ${p.planObjective}).` +
        (p.relevantMilestones.length > 0 ? `\nPlan milestones: ${p.relevantMilestones.join(', ')}.` : '') +
        (p.relevantConstraints.length > 0 ? `\nPlan constraints: ${p.relevantConstraints.join(', ')}.` : '') +
        (p.relevantRisks.length > 0 ? `\nPlan risks: ${p.relevantRisks.join(', ')}.` : '') +
        (p.relevantAssumptions.length > 0 ? `\nPlan assumptions: ${p.relevantAssumptions.join(', ')}.` : ''),
    )
  }

  parts.push(context.userConstraints.length > 0 ? `User-stated constraints:\n${context.userConstraints.map((c) => `- ${c}`).join('\n')}` : 'User-stated constraints: (none supplied)')

  parts.push(
    context.activeWorkspaceObjectives.length > 0
      ? `Other active objectives already tracked in this workspace (for awareness):\n${context.activeWorkspaceObjectives.map((o) => `- ${o}`).join('\n')}`
      : 'Other active objectives already tracked in this workspace: (none)',
  )

  parts.push(
    context.relevantEvidence.length > 0
      ? `Relevant passages retrieved from the user's own library:\n${context.relevantEvidence.map((k, i) => `${i + 1}. [${k.title}] ${k.excerpt}`).join('\n')}`
      : "Relevant passages retrieved from the user's own library: (none found)",
  )

  return parts.join('\n\n')
}
