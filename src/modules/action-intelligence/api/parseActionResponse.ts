import type { Action, ActionActor, ActionActorType, ActionContextSource, ActionDependency, ActionDependencyKind, ActionExpectedOutput, ActionPriority, ActionType } from '@/modules/action-intelligence/action'

const VALID_TYPES: ReadonlySet<string> = new Set<ActionType>(['action', 'task', 'follow_up', 'information_request', 'decision_required'])
const VALID_PRIORITIES: ReadonlySet<string> = new Set<ActionPriority>(['low', 'medium', 'high'])
const VALID_ACTOR_TYPES: ReadonlySet<string> = new Set<ActionActorType>(['user', 'described', 'unassigned'])
const VALID_DEPENDENCY_KINDS: ReadonlySet<string> = new Set<ActionDependencyKind>(['action', 'decision', 'objective'])

/**
 * The parsed shape before deterministic readiness is computed and
 * `source` is attached. Never sets `readiness` itself (that's exclusively
 * computeActionReadiness.ts's job — the model's own opinion about
 * readiness is never asked for or trusted). Never sets `source` either:
 * a single generation call can combine plan + decision + instruction
 * context at once, and asking the model to attribute each individual
 * action back to one specific input would be a precision the prompt
 * doesn't actually support — runActionIntelligence.ts assigns one
 * consistent `source` for the whole batch, deterministically, from
 * whichever inputs were actually supplied to it.
 */
export type ParsedAction = Omit<Action, 'readiness' | 'source'>

export interface ParsedActionFields {
  title: string
  actions: ParsedAction[]
}

export type ActionParseResult = { status: 'action_set'; fields: ParsedActionFields } | { status: 'declined'; reason: string } | { status: 'invalid'; reason: string }

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

/** Resolves the model's "evidenceNumbers" (1-based indices into the numbered evidence list actually shown in the prompt) to real ActionContextSource ids — an out-of-range or non-integer number is silently dropped, never guessed. Mirrors parseDecisionResponse.ts's own resolveEvidenceIds. */
function resolveEvidenceIds(raw: unknown, sources: ActionContextSource[]): string[] {
  if (!Array.isArray(raw)) return []
  return Array.from(new Set(raw.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= sources.length).map((n) => sources[n - 1]!.id)))
}

function parseActor(raw: unknown): ActionActor {
  if (!isRecord(raw)) return { type: 'unassigned', label: null }
  const type = typeof raw.type === 'string' && VALID_ACTOR_TYPES.has(raw.type) ? (raw.type as ActionActorType) : 'unassigned'
  const label = type === 'unassigned' ? null : str(raw.label)
  return { type: label ? type : 'unassigned', label }
}

function parseExpectedOutput(raw: unknown): ActionExpectedOutput {
  if (!isRecord(raw)) return { outcome: '', completionCriteria: null }
  return { outcome: str(raw.outcome) ?? '', completionCriteria: str(raw.completionCriteria) }
}

/**
 * Parses the action-generate-action-set capability's structured JSON
 * response — same conservative, discriminated-union philosophy as
 * parsePlanningResponse.ts/parseDecisionResponse.ts: a malformed entry
 * is dropped, never repaired with a guess. Dependency `targetLocalId`
 * references are resolved against the real localId map this same
 * response defined; `objectiveNumber` references are resolved against
 * the real, numbered `objectives` list actually shown in the prompt
 * (see buildActionContext.ts/formatActionContextForPrompt.ts) — an
 * unresolvable reference in either case is dropped, never guessed.
 * `readiness` is never parsed from the model at all (see ParsedAction's
 * own doc comment) — that is exclusively computeActionReadiness.ts's
 * job, run afterward by the orchestration function.
 */
export function parseActionResponse(rawText: string, sources: ActionContextSource[], objectives: { id: string; content: string }[]): ActionParseResult {
  const text = stripCodeFences(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { status: 'invalid', reason: 'The action-generation response was not valid JSON.' }
  }

  if (!isRecord(parsed)) return { status: 'invalid', reason: 'The action-generation response was not a JSON object.' }

  if (parsed.declined === true) {
    return { status: 'declined', reason: str(parsed.reason) ?? 'There was nothing actionable in the given context.' }
  }

  const title = str(parsed.title)
  if (!title) return { status: 'invalid', reason: 'The action-generation response had no usable title.' }

  if (!Array.isArray(parsed.actions)) {
    return { status: 'invalid', reason: 'The action-generation response had no usable actions array.' }
  }

  // First pass: assign real ids to every well-formed action draft, building the localId -> id map
  // dependency resolution needs, exactly like parsePlanningResponse.ts's own two-pass milestone/task approach.
  const idByLocalId = new Map<string, string>()
  const drafts: { localId: string; raw: Record<string, unknown> }[] = []
  for (const raw of parsed.actions) {
    if (!isRecord(raw)) continue
    const localId = str(raw.localId)
    const actionTitle = str(raw.title)
    if (!localId || !actionTitle || idByLocalId.has(localId)) continue
    idByLocalId.set(localId, crypto.randomUUID())
    drafts.push({ localId, raw })
  }

  const actions: ParsedAction[] = drafts.map(({ localId, raw }, index) => {
    const type = typeof raw.type === 'string' && VALID_TYPES.has(raw.type) ? (raw.type as ActionType) : 'action'
    const priority = typeof raw.priority === 'string' && VALID_PRIORITIES.has(raw.priority) ? (raw.priority as ActionPriority) : 'medium'

    const dependencies: ActionDependency[] = []
    if (Array.isArray(raw.dependsOn)) {
      for (const rawDep of raw.dependsOn) {
        if (!isRecord(rawDep)) continue
        if (typeof rawDep.kind !== 'string' || !VALID_DEPENDENCY_KINDS.has(rawDep.kind)) continue
        const kind = rawDep.kind as ActionDependencyKind
        const description = str(rawDep.description) ?? ''

        if (kind === 'action') {
          const targetLocalId = typeof rawDep.targetLocalId === 'string' ? rawDep.targetLocalId : null
          const targetId = targetLocalId ? (idByLocalId.get(targetLocalId) ?? null) : null
          // Drop unresolvable and self-referential action dependencies — never guessed, never a self-loop.
          if (!targetId || targetId === idByLocalId.get(localId)) continue
          dependencies.push({ id: crypto.randomUUID(), kind, targetId, description })
        } else if (kind === 'decision') {
          if (!description) continue
          dependencies.push({ id: crypto.randomUUID(), kind, targetId: null, description })
        } else {
          const objectiveNumber = typeof rawDep.objectiveNumber === 'number' ? rawDep.objectiveNumber : null
          const targetId = objectiveNumber && Number.isInteger(objectiveNumber) && objectiveNumber >= 1 && objectiveNumber <= objectives.length ? objectives[objectiveNumber - 1]!.id : null
          if (!targetId) continue // an unresolvable objective reference is dropped, never guessed
          dependencies.push({ id: crypto.randomUUID(), kind, targetId, description })
        }
      }
    }

    return {
      id: idByLocalId.get(localId)!,
      title: str(raw.title)!,
      description: str(raw.description) ?? '',
      type,
      status: 'proposed',
      priority,
      sequence: typeof raw.sequence === 'number' && Number.isFinite(raw.sequence) ? raw.sequence : index + 1,
      dependencies,
      actor: parseActor(raw.actor),
      expectedOutput: parseExpectedOutput(raw.expectedOutput),
      dueHint: str(raw.dueHint),
      evidenceIds: resolveEvidenceIds(raw.evidenceNumbers, sources),
    }
  })

  return { status: 'action_set', fields: { title, actions } }
}
