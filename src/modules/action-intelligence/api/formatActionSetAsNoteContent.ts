import type { Action, ActionSet } from '@/modules/action-intelligence/action'

const READINESS_LABEL: Record<string, string> = {
  ready: 'Ready',
  partially_ready: 'Partially ready',
  blocked: 'Blocked',
  needs_information: 'Needs information',
  needs_decision: 'Needs a decision',
}

const TYPE_LABEL: Record<string, string> = {
  action: 'Action',
  task: 'Task',
  follow_up: 'Follow-up',
  information_request: 'Information request',
  decision_required: 'Decision required',
}

/** Exported separately so Phase 15's "Copy action" affordance (ActionsPage.tsx) can reuse the exact same rendering as the note/action-set export — one source of truth for "what does this action look like as text." */
export function formatActionAsText(action: Action): string {
  return formatAction(action).join('\n')
}

function formatAction(action: Action): string[] {
  const lines: string[] = [`### ${action.title}`, `[${TYPE_LABEL[action.type] ?? action.type}] Status: ${READINESS_LABEL[action.readiness.state] ?? action.readiness.state} — Priority: ${action.priority}`, action.description]

  const actorLabel = action.actor.type === 'unassigned' ? 'Unassigned' : (action.actor.label ?? action.actor.type)
  lines.push(`Responsible: ${actorLabel}`)

  if (action.dueHint) lines.push(`Timing: ${action.dueHint}`)

  if (action.readiness.blockers.length > 0) {
    lines.push('Blockers:')
    for (const b of action.readiness.blockers) lines.push(`- ${b}`)
  }
  if (action.readiness.missingInformation.length > 0) {
    lines.push('Missing information:')
    for (const m of action.readiness.missingInformation) lines.push(`- ${m}`)
  }
  if (action.dependencies.length > 0) {
    lines.push('Dependencies:')
    for (const d of action.dependencies) lines.push(`- [${d.kind}] ${d.description}`)
  }

  lines.push(`Expected outcome: ${action.expectedOutput.outcome}`)
  if (action.expectedOutput.completionCriteria) lines.push(`Completion criteria: ${action.expectedOutput.completionCriteria}`)

  return lines
}

/** Renders a completed ActionSet as note content — mirrors formatDecisionAsNoteContent.ts's own plain-text-with-headings convention. Readiness/blockers/missing-information are always rendered, even for a 'ready' action, so the note never implies more certainty than computeActionReadiness.ts actually determined. */
export function formatActionSetAsNoteContent(actionSet: ActionSet): string {
  const lines: string[] = [`# ${actionSet.title}`]

  if (actionSet.objective) lines.push('', `Objective: ${actionSet.objective}`)

  if (actionSet.validationIssues.length > 0) {
    lines.push('', '## Structural issues')
    for (const issue of actionSet.validationIssues) lines.push(`- ${issue.message}`)
  }

  if (actionSet.actions.length > 0) {
    lines.push('', '## Actions')
    for (const action of [...actionSet.actions].sort((a, b) => a.sequence - b.sequence)) {
      lines.push('', ...formatAction(action))
    }
  }

  if (actionSet.contextEvidence.length > 0) {
    lines.push('', '## Evidence')
    for (const e of actionSet.contextEvidence) lines.push(`- [${e.type}] ${e.title}`)
  }

  return lines.join('\n')
}
