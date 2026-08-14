import type {
  Alternative,
  AlternativeEvaluation,
  CriterionImportance,
  DecisionAssumption,
  DecisionConstraint,
  DecisionConstraintSeverity,
  DecisionConstraintType,
  DecisionContextSource,
  DecisionCriterion,
  DecisionRisk,
  InformationOrigin,
  RiskLevel,
} from '@/modules/decision-intelligence/decision'

const VALID_ORIGINS: ReadonlySet<string> = new Set<InformationOrigin>(['known', 'assumed', 'unknown', 'requires_user_input'])
const VALID_IMPORTANCE: ReadonlySet<string> = new Set<CriterionImportance>(['low', 'medium', 'high'])
const VALID_CONFIDENCE: ReadonlySet<string> = new Set(['low', 'medium', 'high'])
const VALID_RISK_LEVELS: ReadonlySet<string> = new Set<RiskLevel>(['low', 'medium', 'high'])
const VALID_CONSTRAINT_TYPES: ReadonlySet<string> = new Set<DecisionConstraintType>(['time', 'budget', 'resource', 'technical', 'organizational', 'other'])
const VALID_SEVERITIES: ReadonlySet<string> = new Set<DecisionConstraintSeverity>(['hard', 'soft'])
/** Score range the prompt itself asks for — 0-10, higher is always better on that criterion. */
const MIN_SCORE = 0
const MAX_SCORE = 10

export interface ParsedDecisionFields {
  title: string
  alternatives: Alternative[]
  criteria: DecisionCriterion[]
  evaluations: AlternativeEvaluation[]
  risks: DecisionRisk[]
  assumptions: DecisionAssumption[]
  constraints: DecisionConstraint[]
  unknowns: string[]
  consequences: string[]
  recommendedAlternativeId: string | null
  confidence: 'low' | 'medium' | 'high' | null
  rationale: string | null
  tradeoffs: string[]
  nextAction: string | null
}

export type DecisionParseResult = { status: 'decision'; decision: ParsedDecisionFields } | { status: 'declined'; reason: string } | { status: 'invalid'; reason: string }

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

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : []
}

/** Resolves the model's "evidenceNumbers" (1-based indices into the numbered evidence list actually shown in the prompt) to real DecisionContextSource ids — an out-of-range or non-integer number is silently dropped, never guessed. */
function resolveEvidenceIds(raw: unknown, sources: DecisionContextSource[]): string[] {
  if (!Array.isArray(raw)) return []
  return Array.from(
    new Set(raw.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= sources.length).map((n) => sources[n - 1]!.id)),
  )
}

function parseAlternatives(raw: unknown, sources: DecisionContextSource[]): { alternatives: Alternative[]; idByLocalId: Map<string, string> } {
  const idByLocalId = new Map<string, string>()
  if (!Array.isArray(raw)) return { alternatives: [], idByLocalId }

  const alternatives: Alternative[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const localId = str(item.localId)
    const title = str(item.title)
    if (!localId || !title || idByLocalId.has(localId)) continue
    const id = crypto.randomUUID()
    idByLocalId.set(localId, id)
    alternatives.push({
      id,
      title,
      description: str(item.description) ?? '',
      advantages: strArray(item.advantages),
      disadvantages: strArray(item.disadvantages),
      estimatedImpact: str(item.estimatedImpact),
      risks: strArray(item.risks),
      evidenceIds: resolveEvidenceIds(item.evidenceNumbers, sources),
    })
  }
  return { alternatives, idByLocalId }
}

function parseCriteria(raw: unknown): { criteria: DecisionCriterion[]; idByLocalId: Map<string, string> } {
  const idByLocalId = new Map<string, string>()
  if (!Array.isArray(raw)) return { criteria: [], idByLocalId }

  const criteria: DecisionCriterion[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const localId = str(item.localId)
    const name = str(item.name)
    if (!localId || !name || idByLocalId.has(localId)) continue
    if (typeof item.weight !== 'number' || !Number.isFinite(item.weight)) continue
    const id = crypto.randomUUID()
    idByLocalId.set(localId, id)
    criteria.push({
      id,
      name,
      description: str(item.description) ?? '',
      weight: item.weight,
      importance: typeof item.importance === 'string' && VALID_IMPORTANCE.has(item.importance) ? (item.importance as CriterionImportance) : 'medium',
      evaluationMethod: str(item.evaluationMethod),
    })
  }
  return { criteria, idByLocalId }
}

function parseEvaluations(raw: unknown, alternativeIdByLocalId: Map<string, string>, criterionIdByLocalId: Map<string, string>, sources: DecisionContextSource[]): AlternativeEvaluation[] {
  if (!Array.isArray(raw)) return []
  const out: AlternativeEvaluation[] = []
  const seen = new Set<string>()

  for (const item of raw) {
    if (!isRecord(item)) continue
    const alternativeId = typeof item.alternativeId === 'string' ? alternativeIdByLocalId.get(item.alternativeId) : undefined
    const criterionId = typeof item.criterionId === 'string' ? criterionIdByLocalId.get(item.criterionId) : undefined
    if (!alternativeId || !criterionId) continue
    const key = `${alternativeId}:${criterionId}`
    if (seen.has(key)) continue // a duplicate (alternative, criterion) pair — keep only the first, never overwrite silently with an inconsistent second value
    if (typeof item.score !== 'number' || !Number.isFinite(item.score) || item.score < MIN_SCORE || item.score > MAX_SCORE) continue
    const rationale = str(item.rationale)
    if (!rationale) continue
    seen.add(key)
    out.push({
      alternativeId,
      criterionId,
      score: item.score,
      rationale,
      confidence: typeof item.confidence === 'string' && VALID_CONFIDENCE.has(item.confidence) ? (item.confidence as AlternativeEvaluation['confidence']) : 'low',
      evidenceIds: resolveEvidenceIds(item.evidenceNumbers, sources),
    })
  }
  return out
}

function parseRisks(raw: unknown, sources: DecisionContextSource[]): DecisionRisk[] {
  if (!Array.isArray(raw)) return []
  const out: DecisionRisk[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const description = str(item.description)
    if (!description) continue
    if (typeof item.impact !== 'string' || !VALID_RISK_LEVELS.has(item.impact)) continue
    const likelihood = typeof item.likelihood === 'string' && VALID_RISK_LEVELS.has(item.likelihood) ? (item.likelihood as RiskLevel) : null
    out.push({ id: crypto.randomUUID(), description, likelihood, impact: item.impact as RiskLevel, mitigation: str(item.mitigation), evidenceIds: resolveEvidenceIds(item.evidenceNumbers, sources) })
  }
  return out
}

function parseAssumptions(raw: unknown, sources: DecisionContextSource[]): DecisionAssumption[] {
  if (!Array.isArray(raw)) return []
  const out: DecisionAssumption[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const statement = str(item.statement)
    if (!statement) continue
    const origin = typeof item.origin === 'string' && VALID_ORIGINS.has(item.origin) ? (item.origin as InformationOrigin) : 'unknown'
    out.push({ id: crypto.randomUUID(), statement, origin, impactIfFalse: str(item.impactIfFalse), evidenceIds: resolveEvidenceIds(item.evidenceNumbers, sources) })
  }
  return out
}

function parseConstraints(raw: unknown): DecisionConstraint[] {
  if (!Array.isArray(raw)) return []
  const out: DecisionConstraint[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const constraint = str(item.constraint)
    if (!constraint) continue
    if (typeof item.type !== 'string' || !VALID_CONSTRAINT_TYPES.has(item.type)) continue
    if (typeof item.severity !== 'string' || !VALID_SEVERITIES.has(item.severity)) continue
    out.push({ id: crypto.randomUUID(), constraint, type: item.type as DecisionConstraintType, severity: item.severity as DecisionConstraintSeverity })
  }
  return out
}

/**
 * Parses the decision-generate-recommendation capability's structured
 * JSON response — same conservative, discriminated-union philosophy as
 * parsePlanningResponse.ts/parseResearchSynthesisResponse.ts: a
 * malformed entry is dropped, never repaired with a guess.
 * alternativeId/criterionId/evidenceNumbers references are resolved
 * against the real localId maps this same response defined — an
 * unresolvable reference is silently dropped here (never guessed);
 * validateDecision.ts is what surfaces the resulting gap honestly (a
 * missing evaluation, a recommendation with no evidence) rather than
 * this parser papering over it.
 */
export function parseDecisionResponse(rawText: string, sources: DecisionContextSource[]): DecisionParseResult {
  const text = stripCodeFences(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { status: 'invalid', reason: 'The decision-generation response was not valid JSON.' }
  }

  if (!isRecord(parsed)) return { status: 'invalid', reason: 'The decision-generation response was not a JSON object.' }

  if (parsed.declined === true) {
    return { status: 'declined', reason: str(parsed.reason) ?? 'The decision could not be analyzed as given.' }
  }

  const title = str(parsed.title)
  if (!title) return { status: 'invalid', reason: 'The decision-generation response had no usable title.' }

  const { alternatives, idByLocalId: alternativeIdByLocalId } = parseAlternatives(parsed.alternatives, sources)
  const { criteria, idByLocalId: criterionIdByLocalId } = parseCriteria(parsed.criteria)
  const evaluations = parseEvaluations(parsed.evaluations, alternativeIdByLocalId, criterionIdByLocalId, sources)
  const recommendedAlternativeId = typeof parsed.recommendedAlternativeId === 'string' ? (alternativeIdByLocalId.get(parsed.recommendedAlternativeId) ?? null) : null

  return {
    status: 'decision',
    decision: {
      title,
      alternatives,
      criteria,
      evaluations,
      risks: parseRisks(parsed.risks, sources),
      assumptions: parseAssumptions(parsed.assumptions, sources),
      constraints: parseConstraints(parsed.constraints),
      unknowns: strArray(parsed.unknowns),
      consequences: strArray(parsed.consequences),
      recommendedAlternativeId,
      confidence: typeof parsed.confidence === 'string' && VALID_CONFIDENCE.has(parsed.confidence) ? (parsed.confidence as 'low' | 'medium' | 'high') : null,
      rationale: str(parsed.rationale),
      tradeoffs: strArray(parsed.tradeoffs),
      nextAction: str(parsed.nextAction),
    },
  }
}
