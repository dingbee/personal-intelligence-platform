import type {
  InformationOrigin,
  PlanAssumption,
  PlanConstraint,
  PlanConstraintSeverity,
  PlanConstraintType,
  PlanDecision,
  PlanMilestone,
  PlanObjective,
  PlanOutput,
  PlanPriority,
  PlanResource,
  PlanResourceKind,
  PlanRisk,
  PlanRiskLevel,
  PlanTask,
  PlanTaskStatus,
  PlanWorkstream,
} from '@/modules/planning-intelligence/plan'

const VALID_ORIGINS: ReadonlySet<string> = new Set<InformationOrigin>(['known', 'assumed', 'unknown', 'requires_user_input'])
const VALID_KNOWN_OR_ASSUMED: ReadonlySet<string> = new Set(['known', 'assumed'])
const VALID_CONSTRAINT_TYPES: ReadonlySet<string> = new Set<PlanConstraintType>(['time', 'budget', 'resource', 'technical', 'organizational', 'other'])
const VALID_SEVERITIES: ReadonlySet<string> = new Set<PlanConstraintSeverity>(['hard', 'soft'])
const VALID_PRIORITIES: ReadonlySet<string> = new Set<PlanPriority>(['low', 'medium', 'high'])
const VALID_RISK_LEVELS: ReadonlySet<string> = new Set<PlanRiskLevel>(['low', 'medium', 'high'])
const VALID_CONFIDENCE: ReadonlySet<string> = new Set(['low', 'medium', 'high'])
const VALID_RESOURCE_KINDS: ReadonlySet<string> = new Set<PlanResourceKind>(['person', 'budget', 'material', 'tool', 'other'])

export interface ParsedPlanFields {
  title: string
  description: string | null
  currentState: string | null
  desiredOutcome: string | null
  gapAnalysis: string | null
  assumptions: PlanAssumption[]
  constraints: PlanConstraint[]
  objectives: PlanObjective[]
  workstreams: PlanWorkstream[]
  milestones: PlanMilestone[]
  tasks: PlanTask[]
  risks: PlanRisk[]
  decisions: PlanDecision[]
  outputs: PlanOutput[]
  successCriteria: string[]
  resources: PlanResource[]
  deadline: string | null
}

export type PlanningParseResult = { status: 'plan'; plan: ParsedPlanFields } | { status: 'declined'; reason: string } | { status: 'invalid'; reason: string }

/** Exported for parseRevisedPlanningResponse.ts, which reuses this whole file's own field parsers rather than reimplementing them. */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1]!.trim() : trimmed
}

export function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** A real ISO-8601 calendar date (YYYY-MM-DD) — validated by actually parsing it, not just matching the shape (rejects e.g. "2027-02-30"). Never inferred or repaired; a malformed value is dropped, exactly like every other free-form model field here. */
export function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const [, y, m, d] = match.map(Number) as [never, number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  const isReal = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  return isReal ? match[0]! : null
}

function positiveFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function parseAssumptions(raw: unknown): PlanAssumption[] {
  if (!Array.isArray(raw)) return []
  const out: PlanAssumption[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const statement = str(item.statement)
    if (!statement) continue
    const origin = typeof item.origin === 'string' && VALID_ORIGINS.has(item.origin) ? (item.origin as InformationOrigin) : 'unknown'
    const confidence = typeof item.confidence === 'string' && VALID_CONFIDENCE.has(item.confidence) ? (item.confidence as PlanAssumption['confidence']) : 'low'
    out.push({ id: crypto.randomUUID(), statement, origin, confidence })
  }
  return out
}

export function parseConstraints(raw: unknown): PlanConstraint[] {
  if (!Array.isArray(raw)) return []
  const out: PlanConstraint[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const constraint = str(item.constraint)
    if (!constraint) continue
    if (typeof item.type !== 'string' || !VALID_CONSTRAINT_TYPES.has(item.type)) continue
    if (typeof item.severity !== 'string' || !VALID_SEVERITIES.has(item.severity)) continue
    const origin = typeof item.origin === 'string' && VALID_KNOWN_OR_ASSUMED.has(item.origin) ? (item.origin as 'known' | 'assumed') : 'assumed'
    out.push({ id: crypto.randomUUID(), constraint, type: item.type as PlanConstraintType, severity: item.severity as PlanConstraintSeverity, origin })
  }
  return out
}

export function parseObjectives(raw: unknown): PlanObjective[] {
  if (!Array.isArray(raw)) return []
  const out: PlanObjective[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const statement = str(item.statement)
    if (!statement) continue
    const origin = typeof item.origin === 'string' && VALID_KNOWN_OR_ASSUMED.has(item.origin) ? (item.origin as 'known' | 'assumed') : 'assumed'
    out.push({ id: crypto.randomUUID(), statement, origin })
  }
  return out
}

/** Default id assignment — always a fresh id, regardless of what localId string the model chose. parseRevisedPlanningResponse.ts overrides this with a strategy that reuses a REAL prior id when the model's localId matches one it was shown as an existing item's own id (see that file's own doc comment) — that's what lets a revision genuinely preserve unaffected work rather than mint an all-new plan. */
export const freshId = (): string => crypto.randomUUID()

/** localId-referenced records, exactly like parseMilestones/parseTasks below — a downstream task's `workstreamId` resolves through the returned map, never trusted as a real id directly. */
export function parseWorkstreams(raw: unknown, mintId: (localId: string) => string = freshId): { workstreams: PlanWorkstream[]; idByLocalId: Map<string, string> } {
  const idByLocalId = new Map<string, string>()
  if (!Array.isArray(raw)) return { workstreams: [], idByLocalId }

  const workstreams: PlanWorkstream[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const localId = str(item.localId)
    const title = str(item.title)
    if (!localId || !title) continue
    if (idByLocalId.has(localId)) continue
    const id = mintId(localId)
    idByLocalId.set(localId, id)
    workstreams.push({ id, title, description: str(item.description) ?? '' })
  }
  return { workstreams, idByLocalId }
}

export function parseResources(raw: unknown, mintId: (localId: string) => string = freshId): { resources: PlanResource[]; idByLocalId: Map<string, string> } {
  const idByLocalId = new Map<string, string>()
  if (!Array.isArray(raw)) return { resources: [], idByLocalId }

  const resources: PlanResource[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const localId = str(item.localId)
    const name = str(item.name)
    if (!localId || !name) continue
    if (idByLocalId.has(localId)) continue
    if (typeof item.kind !== 'string' || !VALID_RESOURCE_KINDS.has(item.kind)) continue
    const id = mintId(localId)
    idByLocalId.set(localId, id)
    const origin = typeof item.origin === 'string' && VALID_KNOWN_OR_ASSUMED.has(item.origin) ? (item.origin as 'known' | 'assumed') : 'assumed'
    resources.push({ id, name, kind: item.kind as PlanResourceKind, capacity: positiveFiniteNumber(item.capacity), unit: str(item.unit), origin })
  }
  return { resources, idByLocalId }
}

/** Milestones/tasks reference each other by a model-supplied "localId" string — never trusted directly as a real id, always resolved through this map (unresolvable references are dropped, never guessed). */
export function parseMilestones(raw: unknown, mintId: (localId: string) => string = freshId): { milestones: PlanMilestone[]; idByLocalId: Map<string, string> } {
  const idByLocalId = new Map<string, string>()
  if (!Array.isArray(raw)) return { milestones: [], idByLocalId }

  const drafts: { localId: string; title: string; description: string; target: string | null; targetDate: string | null; sequence: number; dependsOnLocalIds: unknown }[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const localId = str(item.localId)
    const title = str(item.title)
    if (!localId || !title) continue
    if (idByLocalId.has(localId)) continue
    const id = mintId(localId)
    idByLocalId.set(localId, id)
    drafts.push({
      localId,
      title,
      description: str(item.description) ?? '',
      target: str(item.target),
      targetDate: isoDate(item.targetDate),
      sequence: typeof item.sequence === 'number' && Number.isFinite(item.sequence) ? item.sequence : drafts.length + 1,
      dependsOnLocalIds: item.dependsOn,
    })
  }

  const milestones: PlanMilestone[] = drafts.map((d) => ({
    id: idByLocalId.get(d.localId)!,
    title: d.title,
    description: d.description,
    target: d.target,
    targetDate: d.targetDate,
    sequence: d.sequence,
    dependsOnMilestoneIds: Array.isArray(d.dependsOnLocalIds)
      ? Array.from(new Set(d.dependsOnLocalIds.filter((l): l is string => typeof l === 'string' && idByLocalId.has(l) && idByLocalId.get(l) !== idByLocalId.get(d.localId)).map((l) => idByLocalId.get(l)!)))
      : [],
  }))

  return { milestones, idByLocalId }
}

export function parseResourceRequirements(raw: unknown, resourceIdByLocalId: Map<string, string>): { resourceId: string; amount: number }[] {
  if (!Array.isArray(raw)) return []
  const out: { resourceId: string; amount: number }[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (!isRecord(item)) continue
    const localId = typeof item.resourceId === 'string' ? item.resourceId : null
    if (!localId || !resourceIdByLocalId.has(localId)) continue
    const amount = positiveFiniteNumber(item.amount)
    if (amount === null) continue
    const resourceId = resourceIdByLocalId.get(localId)!
    if (seen.has(resourceId)) continue
    seen.add(resourceId)
    out.push({ resourceId, amount })
  }
  return out
}

export function parseTasks(
  raw: unknown,
  milestoneIdByLocalId: Map<string, string>,
  workstreamIdByLocalId: Map<string, string>,
  resourceIdByLocalId: Map<string, string>,
  mintId: (localId: string) => string = freshId,
  /** A freshly generated plan has no progress yet — always 'not_started'. parseRevisedPlanningResponse.ts overrides this to preserve an unaffected task's REAL existing status (in_progress/blocked/completed/cancelled) rather than silently resetting real progress to 'not_started' on every revision. */
  initialStatus: (taskId: string) => PlanTaskStatus = () => 'not_started',
): PlanTask[] {
  if (!Array.isArray(raw)) return []

  const idByLocalId = new Map<string, string>()
  const drafts: {
    localId: string
    title: string
    description: string
    priority: PlanPriority
    sequence: number
    dependsOnLocalIds: unknown
    milestoneLocalId: unknown
    workstreamLocalId: unknown
    estimatedEffort: string | null
    requiredResources: string[]
    resourceRequirements: { resourceId: string; amount: number }[]
  }[] = []

  for (const item of raw) {
    if (!isRecord(item)) continue
    const localId = str(item.localId)
    const title = str(item.title)
    if (!localId || !title) continue
    if (idByLocalId.has(localId)) continue
    idByLocalId.set(localId, mintId(localId))
    drafts.push({
      localId,
      title,
      description: str(item.description) ?? '',
      priority: typeof item.priority === 'string' && VALID_PRIORITIES.has(item.priority) ? (item.priority as PlanPriority) : 'medium',
      sequence: typeof item.sequence === 'number' && Number.isFinite(item.sequence) ? item.sequence : drafts.length + 1,
      dependsOnLocalIds: item.dependsOn,
      milestoneLocalId: item.milestoneId,
      workstreamLocalId: item.workstreamId,
      estimatedEffort: str(item.estimatedEffort),
      requiredResources: Array.isArray(item.requiredResources) ? item.requiredResources.filter((r): r is string => typeof r === 'string' && r.trim().length > 0) : [],
      resourceRequirements: parseResourceRequirements(item.resourceRequirements, resourceIdByLocalId),
    })
  }

  return drafts.map((d) => ({
    id: idByLocalId.get(d.localId)!,
    title: d.title,
    description: d.description,
    status: initialStatus(idByLocalId.get(d.localId)!),
    priority: d.priority,
    sequence: d.sequence,
    dependsOnTaskIds: Array.isArray(d.dependsOnLocalIds)
      ? Array.from(new Set(d.dependsOnLocalIds.filter((l): l is string => typeof l === 'string' && idByLocalId.has(l) && idByLocalId.get(l) !== idByLocalId.get(d.localId)).map((l) => idByLocalId.get(l)!)))
      : [],
    milestoneId: typeof d.milestoneLocalId === 'string' && milestoneIdByLocalId.has(d.milestoneLocalId) ? milestoneIdByLocalId.get(d.milestoneLocalId)! : null,
    workstreamId: typeof d.workstreamLocalId === 'string' && workstreamIdByLocalId.has(d.workstreamLocalId) ? workstreamIdByLocalId.get(d.workstreamLocalId)! : null,
    estimatedEffort: d.estimatedEffort,
    requiredResources: d.requiredResources,
    resourceRequirements: d.resourceRequirements,
  }))
}

export function parseRisks(raw: unknown): PlanRisk[] {
  if (!Array.isArray(raw)) return []
  const out: PlanRisk[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const risk = str(item.risk)
    if (!risk) continue
    if (typeof item.impact !== 'string' || !VALID_RISK_LEVELS.has(item.impact)) continue
    const probability = typeof item.probability === 'string' && VALID_RISK_LEVELS.has(item.probability) ? (item.probability as PlanRiskLevel) : null
    out.push({ id: crypto.randomUUID(), risk, probability, impact: item.impact as PlanRiskLevel, mitigation: str(item.mitigation), contingency: str(item.contingency) })
  }
  return out
}

export function parseDecisions(raw: unknown): PlanDecision[] {
  if (!Array.isArray(raw)) return []
  const out: PlanDecision[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const decision = str(item.decision)
    if (!decision) continue
    const options = Array.isArray(item.options)
      ? item.options
          .filter((o): o is Record<string, unknown> => isRecord(o) && typeof o.option === 'string' && o.option.trim().length > 0)
          .map((o) => ({ option: (o.option as string).trim(), tradeoff: str(o.tradeoff) }))
      : []
    out.push({ id: crypto.randomUUID(), decision, options, recommendation: str(item.recommendation), unresolved: item.unresolved === true, decisionIntelligence: null })
  }
  return out
}

export function parseOutputs(raw: unknown): PlanOutput[] {
  if (!Array.isArray(raw)) return []
  const out: PlanOutput[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const deliverable = str(item.deliverable)
    const completionCriteria = str(item.completionCriteria)
    if (!deliverable || !completionCriteria) continue
    out.push({ id: crypto.randomUUID(), deliverable, completionCriteria })
  }
  return out
}

/**
 * Parses the planning-generate-plan capability's structured JSON
 * response. Returns 'invalid' on total parse failure or a missing
 * "title" (the one field that must exist for the result to be a plan at
 * all); returns 'declined' when the model itself reported the objective
 * as unplannable. Every array field is filtered element-by-element —
 * a malformed entry is dropped, never repaired with a guess — mirroring
 * parseResearchSynthesisResponse.ts's own conservative philosophy.
 * Milestone/task/workstream/resource cross-references are resolved via
 * their model-supplied "localId" strings; an unresolvable reference (a
 * localId that was never actually defined) is silently dropped rather
 * than treated as an error, since validatePlan.ts's dangling-reference
 * check surfaces this honestly to the caller afterward.
 *
 * `decisions[].decisionIntelligence` always parses to null here — a
 * real delegated Decision Intelligence outcome is only ever attached
 * afterward, by runPlanningIntelligence.ts itself, never by this parser
 * (the model has no way to produce one).
 */
export function parsePlanningResponse(rawText: string): PlanningParseResult {
  const text = stripCodeFences(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { status: 'invalid', reason: 'The plan-generation response was not valid JSON.' }
  }

  if (!isRecord(parsed)) return { status: 'invalid', reason: 'The plan-generation response was not a JSON object.' }

  if (parsed.declined === true) {
    return { status: 'declined', reason: str(parsed.reason) ?? 'The objective could not be planned as given.' }
  }

  const title = str(parsed.title)
  if (!title) return { status: 'invalid', reason: 'The plan-generation response had no usable title.' }

  const { milestones, idByLocalId: milestoneIdByLocalId } = parseMilestones(parsed.milestones)
  const { workstreams, idByLocalId: workstreamIdByLocalId } = parseWorkstreams(parsed.workstreams)
  const { resources, idByLocalId: resourceIdByLocalId } = parseResources(parsed.resources)

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
      tasks: parseTasks(parsed.tasks, milestoneIdByLocalId, workstreamIdByLocalId, resourceIdByLocalId),
      risks: parseRisks(parsed.risks),
      decisions: parseDecisions(parsed.decisions),
      outputs: parseOutputs(parsed.outputs),
      successCriteria: Array.isArray(parsed.successCriteria) ? parsed.successCriteria.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : [],
      resources,
      deadline: isoDate(parsed.deadline),
    },
  }
}
