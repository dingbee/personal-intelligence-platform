import type { PlanningContext } from '@/modules/planning-intelligence/api/buildPlanningContext'

/**
 * Renders the assembled PlanningContext into the `{{planningSummary}}`
 * variable the planning-generate-plan prompt template injects — plain
 * text, not JSON, mirroring formatResearchForSynthesis.ts's own
 * plain-text-summary convention for feeding structured context into a
 * prompt template.
 */
export function formatPlanningContextForPrompt(context: PlanningContext): string {
  const parts: string[] = [`Objective: ${context.objective}`]

  parts.push(context.userConstraints.length > 0 ? `User-stated constraints:\n${context.userConstraints.map((c) => `- ${c}`).join('\n')}` : 'User-stated constraints: (none supplied)')

  parts.push(
    context.activeWorkspaceObjectives.length > 0
      ? `Other active objectives already tracked in this workspace (for awareness — do not duplicate these):\n${context.activeWorkspaceObjectives.map((o) => `- ${o}`).join('\n')}`
      : 'Other active objectives already tracked in this workspace: (none)',
  )

  parts.push(
    context.relevantKnowledge.length > 0
      ? `Relevant passages retrieved from the user's own library:\n${context.relevantKnowledge.map((k, i) => `${i + 1}. [${k.title}] ${k.excerpt}`).join('\n')}`
      : "Relevant passages retrieved from the user's own library: (none found)",
  )

  return parts.join('\n\n')
}
