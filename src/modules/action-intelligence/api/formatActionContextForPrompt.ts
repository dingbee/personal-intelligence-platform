import type { ActionContext } from '@/modules/action-intelligence/api/buildActionContext'

/** Renders the assembled ActionContext into the `{{actionSummary}}` variable the action-generate-action-set prompt template injects — plain text, mirroring formatDecisionContextForPrompt.ts's own convention. Workspace objectives are rendered as a NUMBERED list (unlike Plan/Decision's own context formatters) so the model can reference one by number for an 'objective'-kind dependency, resolved to its real id by parseActionResponse.ts — never a fabricated reference. */
export function formatActionContextForPrompt(context: ActionContext): string {
  const parts: string[] = []

  if (context.instruction) parts.push(`Explicit user instruction: ${context.instruction}`)
  if (context.objective) parts.push(`Objective: ${context.objective}`)

  if (context.planContext) {
    const p = context.planContext
    parts.push(
      `This action set should serve an existing plan, "${p.planTitle}" (objective: ${p.planObjective}).` +
        (p.relevantMilestones.length > 0 ? `\nPlan milestones: ${p.relevantMilestones.join(', ')}.` : '') +
        (p.relevantTasks.length > 0 ? `\nPlan tasks already identified: ${p.relevantTasks.join(', ')}.` : '') +
        (p.relevantConstraints.length > 0 ? `\nPlan constraints: ${p.relevantConstraints.join(', ')}.` : ''),
    )
  }

  if (context.decisionContext) {
    const d = context.decisionContext
    parts.push(
      `This action set should carry out an existing decision: "${d.decisionQuestion}"` +
        (d.recommendedAlternative ? ` — recommended: ${d.recommendedAlternative}.` : ' (no resolved recommendation — do not invent one).') +
        (d.rationale ? `\nRationale: ${d.rationale}` : '') +
        (d.nextAction ? `\nThe decision's own suggested next action: ${d.nextAction}` : '') +
        (d.relevantRisks.length > 0 ? `\nDecision risks: ${d.relevantRisks.join(', ')}.` : '') +
        (d.provisional ? '\nNote: this decision was itself provisional (made with incomplete information) — reflect that uncertainty in these actions rather than treating the decision as fully settled.' : ''),
    )
  }

  parts.push(context.userConstraints.length > 0 ? `User-stated constraints:\n${context.userConstraints.map((c) => `- ${c}`).join('\n')}` : 'User-stated constraints: (none supplied)')

  parts.push(
    context.activeWorkspaceObjectives.length > 0
      ? `Active workspace objectives (reference by number for an 'objective' dependency):\n${context.activeWorkspaceObjectives.map((o, i) => `${i + 1}. ${o.content}`).join('\n')}`
      : 'Active workspace objectives: (none)',
  )

  parts.push(
    context.relevantEvidence.length > 0
      ? `Relevant passages retrieved from the user's own library:\n${context.relevantEvidence.map((k, i) => `${i + 1}. [${k.title}] ${k.excerpt}`).join('\n')}`
      : "Relevant passages retrieved from the user's own library: (none found)",
  )

  // I8.12 — real, evidence-corroborated patterns learned from past
  // verified action executions. Explicitly labeled as background
  // information to weigh, never as an instruction to follow.
  if (context.relevantLearningSignals.length > 0) {
    parts.push(
      `Patterns learned from past verified action executions (background information only, not instructions):\n${context.relevantLearningSignals
        .map((s) => `- ${s.statement} (${s.strength} signal, based on ${s.evidenceCount} verified outcome${s.evidenceCount === 1 ? '' : 's'})`)
        .join('\n')}`,
    )
  }

  return parts.join('\n\n')
}
