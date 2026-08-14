import type {
  InformationOrigin,
  PlanAssumption,
  PlanConstraint,
  PlanConstraintSeverity,
  PlanConstraintType,
  PlanDecision,
  PlanMilestone,
  PlanOutput,
  PlanPriority,
  PlanRisk,
  PlanRiskLevel,
  PlanTask,
} from '@/modules/planning-intelligence/plan'

const VALID_ORIGINS: ReadonlySet<string> = new Set<InformationOrigin>(['known', 'assumed', 'unknown', 'requires_user_input'])
const VALID_CONSTRAINT_ORIGINS: ReadonlySet<string> = new Set(['known', 'assumed'])
const VALID_CONSTRAINT_TYPES: ReadonlySet<string> = new Set<PlanConstraintType>(['time', 'budget', 'resource', 'technical', 'organizational', 'other'])
const VALID_SEVERITIES: ReadonlySet<string> = new Set<PlanConstraintSeverity>(['hard', 'soft'])
const VALID_PRIORITIES: ReadonlySet<string> = new Set<PlanPriority>(['low', 'medium', 'high'])
const VALID_RISK_LEVELS: ReadonlySet<string> = new Set<PlanRiskLevel>(['low', 'medium', 'high'])
const VALID_CONFIDENCE: ReadonlySet<string> = new Set(['low', 'medium', 'high'])

export interface ParsedPlanFields {
  title: string
  description: string | null
  currentState: string | null
  desiredOutcome: string | null
  gapAnalysis: string | null
  assumptions: PlanAssumption[]
  constraints: PlanConstraint[]
  milestones: PlanMilestone[]
  tasks: PlanTask[]
  risks: PlanRisk[]
  decisions: PlanDecision[]
  outputs: PlanOutput[]
  successCriteria: string[]
}

export type PlanningParseResult = { status: 'plan'; plan: ParsedPlanFields } | { status: 'declined'; reason: string } | { status: 'invalid'; reason: string }

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1]!.trim() : trimmed
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseAssumptions(raw: unknown): PlanAssumption[] {
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

function parseConstraints(raw: unknown): PlanConstraint[] {
  if (!Array.isArray(raw)) return []
  const out: PlanConstraint[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const constraint = str(item.constraint)
    if (!constraint) continue
    if (typeof item.type !== 'string' || !VALID_CONSTRAINT_TYPES.has(item.type)) continue
    if (typeof item.severity !== 'string' || !VALID_SEVERITIES.has(item.severity)) continue
    const origin = typeof item.origin === 'string' && VALID_CONSTRAINT_ORIGINS.has(item.origin) ? (item.origin as 'known' | 'assumed') : 'assumed'
    out.push({ id: crypto.randomUUID(), constraint, type: item.type as PlanConstraintType, severity: item.severity as PlanConstraintSeverity, origin })
  }
  return out
}

/** Milestones/tasks reference each other by a model-supplied "localId" string — never trusted directly as a real id, always resolved through this map (unresolvable references are dropped, never guessed). */
function parseMilestones(raw: unknown): { milestones: PlanMilestone[]; idByLocalId: Map<string, string> } {
  const idByLocalId = new Map<string, string>()
  if (!Array.isArray(raw)) return { milestones: [], idByLocalId }

  const drafts: { localId: string; title: string; description: string; target: string | null; sequence: number; dependsOnLocalIds: unknown }[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const localId = str(item.localId)
    const title = str(item.title)
    if (!localId || !title) continue
    if (idByLocalId.has(localId)) continue
    const id = crypto.randomUUID()
    idByLocalId.set(localId, id)
    drafts.push({
      localId,
      title,
      description: str(item.description) ?? '',
      target: str(item.target),
      sequence: typeof item.sequence === 'number' && Number.isFinite(item.sequence) ? item.sequence : drafts.length + 1,
      dependsOnLocalIds: item.dependsOn,
    })
  }

  const milestones: PlanMilestone[] = drafts.map((d) => ({
    id: idByLocalId.get(d.localId)!,
    title: d.title,
    description: d.description,
    target: d.target,
    sequence: d.sequence,
    dependsOnMilestoneIds: Array.isArray(d.dependsOnLocalIds)
      ? Array.from(new Set(d.dependsOnLocalIds.filter((l): l is string => typeof l === 'string' && idByLocalId.has(l) && idByLocalId.get(l) !== idByLocalId.get(d.localId)).map((l) => idByLocalId.get(l)!)))
      : [],
  }))

  return { milestones, idByLocalId }
}

function parseTasks(raw: unknown, milestoneIdByLocalId: Map<string, string>): PlanTask[] {
  if (!Array.isArray(raw)) return []

  const idByLocalId = new Map<string, string>()
  const drafts: { localId: string; title: string; description: string; priority: PlanPriority; sequence: number; dependsOnLocalIds: unknown; milestoneLocalId: unknown; estimatedEffort: string | null; requiredResources: string[] }[] = []

  for (const item of raw) {
    if (!isRecord(item)) continue
    const localId = str(item.localId)
    const title = str(item.title)
    if (!localId || !title) continue
    if (idByLocalId.has(localId)) continue
    idByLocalId.set(localId, crypto.randomUUID())
    drafts.push({
      localId,
      title,
      description: str(item.description) ?? '',
      priority: typeof item.priority === 'string' && VALID_PRIORITIES.has(item.priority) ? (item.priority as PlanPriority) : 'medium',
      sequence: typeof item.sequence === 'number' && Number.isFinite(item.sequence) ? item.sequence : drafts.length + 1,
      dependsOnLocalIds: item.dependsOn,
      milestoneLocalId: item.milestoneId,
      estimatedEffort: str(item.estimatedEffort),
      requiredResources: Array.isArray(item.requiredResources) ? item.requiredResources.filter((r): r is string => typeof r === 'string' && r.trim().length > 0) : [],
    })
  }

  return drafts.map((d) => ({
    id: idByLocalId.get(d.localId)!,
    title: d.title,
    description: d.description,
    status: 'not_started',
    priority: d.priority,
    sequence: d.sequence,
    dependsOnTaskIds: Array.isArray(d.dependsOnLocalIds)
      ? Array.from(new Set(d.dependsOnLocalIds.filter((l): l is string => typeof l === 'string' && idByLocalId.has(l) && idByLocalId.get(l) !== idByLocalId.get(d.localId)).map((l) => idByLocalId.get(l)!)))
      : [],
    milestoneId: typeof d.milestoneLocalId === 'string' && milestoneIdByLocalId.has(d.milestoneLocalId) ? milestoneIdByLocalId.get(d.milestoneLocalId)! : null,
    estimatedEffort: d.estimatedEffort,
    requiredResources: d.requiredResources,
  }))
}

function parseRisks(raw: unknown): PlanRisk[] {
  if (!Array.isArray(raw)) return []
  const out: PlanRisk[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const risk = str(item.risk)
    if (!risk) continue
    if (typeof item.impact !== 'string' || !VALID_RISK_LEVELS.has(item.impact)) continue
    const probability = typeof item.probability === 'string' && VALID_RISK_LEVELS.has(item.probability) ? (item.probability as PlanRiskLevel) : null
    out.push({ id: crypto.randomUUID(), risk, probability, impact: item.impact as PlanRiskLevel, mitigation: str(item.mitigation) })
  }
  return out
}

function parseDecisions(raw: unknown): PlanDecision[] {
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
    out.push({ id: crypto.randomUUID(), decision, options, recommendation: str(item.recommendation), unresolved: item.unresolved === true })
  }
  return out
}

function parseOutputs(raw: unknown): PlanOutput[] {
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
 * Milestone/task cross-references are resolved via their model-supplied
 * "localId" strings; an unresolvable reference (a localId that was never
 * actually defined) is silently dropped rather than treated as an error,
 * since validatePlan.ts's dangling-reference check surfaces this
 * honestly to the caller afterward.
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
      milestones,
      tasks: parseTasks(parsed.tasks, milestoneIdByLocalId),
      risks: parseRisks(parsed.risks),
      decisions: parseDecisions(parsed.decisions),
      outputs: parseOutputs(parsed.outputs),
      successCriteria: Array.isArray(parsed.successCriteria) ? parsed.successCriteria.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : [],
    },
  }
}
