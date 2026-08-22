import {
  isRecord,
  isoDate,
  parseAssumptions,
  parseConstraints,
  parseDecisions,
  parseMilestones,
  parseObjectives,
  parseOutputs,
  parseResources,
  parseRisks,
  parseTasks,
  parseWorkstreams,
  str,
  stripCodeFences,
} from '@/modules/planning-intelligence/api/parsePlanningResponse'
import type { ParsedPlanFields } from '@/modules/planning-intelligence/api/parsePlanningResponse'
import type { Plan, PlanTaskStatus } from '@/modules/planning-intelligence/plan'

export type { ParsedPlanFields as ParsedRevisedPlanFields }
export type RevisedPlanningParseResult = { status: 'plan'; plan: ParsedPlanFields } | { status: 'declined'; reason: string } | { status: 'invalid'; reason: string }

/**
 * Parses the planning-revise-plan capability's response — structurally
 * identical JSON to planning-generate-plan (see parsePlanningResponse.ts,
 * whose own field parsers this reuses directly rather than duplicating
 * them), with exactly one difference that makes it a genuine REVISION
 * parser rather than a second copy of the generation one: milestone/
 * task/workstream/resource localIds are resolved against the ORIGINAL
 * plan's own real ids first.
 *
 * formatPlanForRevisionPrompt.ts shows the model every existing
 * milestone/task/workstream/resource with its REAL id already filled in
 * as "localId" — the prompt instructs the model to reuse that exact
 * string verbatim for anything unaffected by the described change, and
 * to invent a new, different-looking localId only for a genuinely new
 * item. This function's `mintId` callback checks each localId against
 * the original plan's own id set: a match reuses the SAME real id (so
 * an unaffected item is structurally identical, not just
 * content-identical, to before — the whole point of "preserving
 * unaffected work" rather than quietly regenerating everything with new
 * ids); anything else mints a fresh id exactly like a first-time
 * generation would. The same real-id-preserving discipline extends to
 * each task's own progress `status` (in_progress/blocked/completed/
 * cancelled) — a revision must never silently reset real progress on an
 * unaffected task back to not_started.
 */
export function parseRevisedPlanningResponse(rawText: string, originalPlan: Plan): RevisedPlanningParseResult {
  const text = stripCodeFences(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { status: 'invalid', reason: 'The plan-revision response was not valid JSON.' }
  }

  if (!isRecord(parsed)) return { status: 'invalid', reason: 'The plan-revision response was not a JSON object.' }

  if (parsed.declined === true) {
    return { status: 'declined', reason: str(parsed.reason) ?? 'The revision could not be applied as given.' }
  }

  const title = str(parsed.title)
  if (!title) return { status: 'invalid', reason: 'The plan-revision response had no usable title.' }

  const originalMilestoneIds = new Set(originalPlan.milestones.map((m) => m.id))
  const originalWorkstreamIds = new Set(originalPlan.workstreams.map((w) => w.id))
  const originalResourceIds = new Set(originalPlan.resources.map((r) => r.id))
  const originalTaskIds = new Set(originalPlan.tasks.map((t) => t.id))
  const originalTaskStatusById = new Map(originalPlan.tasks.map((t) => [t.id, t.status]))

  const reuseKnown =
    (knownIds: ReadonlySet<string>) =>
    (localId: string): string =>
      knownIds.has(localId) ? localId : crypto.randomUUID()

  const { milestones, idByLocalId: milestoneIdByLocalId } = parseMilestones(parsed.milestones, reuseKnown(originalMilestoneIds))
  const { workstreams, idByLocalId: workstreamIdByLocalId } = parseWorkstreams(parsed.workstreams, reuseKnown(originalWorkstreamIds))
  const { resources, idByLocalId: resourceIdByLocalId } = parseResources(parsed.resources, reuseKnown(originalResourceIds))
  const tasks = parseTasks(
    parsed.tasks,
    milestoneIdByLocalId,
    workstreamIdByLocalId,
    resourceIdByLocalId,
    reuseKnown(originalTaskIds),
    (taskId: string): PlanTaskStatus => originalTaskStatusById.get(taskId) ?? 'not_started',
  )

  return {
    status: 'plan',
    plan: {
      title,
      description: str(parsed.description),
      currentState: str(parsed.currentState),
      desiredOutcome: str(parsed.desiredOutcome),
      gapAnalysis: str(parsed.gapAnalysis),
      assumptions: parseAssumptions(parsed.assumptions),
      constraints: parseConstraints(parsed.constraints),
      objectives: parseObjectives(parsed.objectives),
      workstreams,
      milestones,
      tasks,
      risks: parseRisks(parsed.risks),
      decisions: parseDecisions(parsed.decisions),
      outputs: parseOutputs(parsed.outputs),
      successCriteria: Array.isArray(parsed.successCriteria) ? parsed.successCriteria.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : [],
      resources,
      deadline: isoDate(parsed.deadline),
    },
  }
}
