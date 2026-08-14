import type { ResearchGap, ResearchGapReason, ResearchSource, SourceComparison, SourceRelationship } from '@/modules/research-intelligence/researchInvestigation'

const VALID_GAP_REASONS: ReadonlySet<string> = new Set<ResearchGapReason>([
  'insufficient_evidence',
  'conflicting_findings',
  'methodological_limitation',
  'missing_variable',
  'unanswered_question',
  'outdated_evidence',
])

const VALID_RELATIONSHIPS: ReadonlySet<string> = new Set<SourceRelationship>([
  'agrees_with',
  'differs_from',
  'provides_additional_evidence',
  'uses_different_methodology',
  'cannot_be_directly_compared',
])

const MAX_FOLLOW_UP_QUESTIONS = 3

export interface SynthesisParseResult {
  keyFindings: string[]
  synthesis: string
  limitations: string
  comparisons: SourceComparison[]
  gaps: ResearchGap[]
  followUpQuestions: string[]
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1]!.trim() : trimmed
}

/**
 * Research Intelligence — parses the research-synthesis capability's
 * structured JSON response. Returns null on total parse failure (not
 * JSON, or missing the required "synthesis" string) — an honest AI
 * synthesis failure (P2 brief's explicit failure-handling requirement),
 * which runResearchInvestigation.ts surfaces as `synthesisFailed: true`
 * rather than fabricating a summary from whatever text came back.
 *
 * Every "comparisons" entry is validated against the real, numbered
 * source list the synthesis prompt was shown (see
 * formatResearchForSynthesis.ts's collectDistinctSources) — a
 * comparison naming an out-of-range source number, fewer than two
 * sources, or an unrecognized relationship value is dropped entirely,
 * never repaired with a guess. "gaps" entries are filtered to the
 * closed ResearchGapReason set for the same reason.
 */
export function parseResearchSynthesisResponse(rawText: string, sources: ResearchSource[]): SynthesisParseResult | null {
  const text = stripCodeFences(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  if (typeof obj.synthesis !== 'string' || !obj.synthesis.trim()) return null

  const keyFindings = Array.isArray(obj.keyFindings) ? obj.keyFindings.filter((f): f is string => typeof f === 'string' && f.trim().length > 0) : []

  const limitations = typeof obj.limitations === 'string' ? obj.limitations.trim() : ''

  const comparisons: SourceComparison[] = []
  if (Array.isArray(obj.comparisons)) {
    for (const raw of obj.comparisons) {
      if (typeof raw !== 'object' || raw === null) continue
      const item = raw as Record<string, unknown>
      if (!Array.isArray(item.sourceNumbers) || typeof item.relationship !== 'string' || typeof item.description !== 'string') continue
      if (!VALID_RELATIONSHIPS.has(item.relationship)) continue
      if (!item.description.trim()) continue

      const sourceIds = item.sourceNumbers
        .filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= sources.length)
        .map((n) => sources[n - 1]!.id)
      const distinctSourceIds = Array.from(new Set(sourceIds))
      if (distinctSourceIds.length < 2) continue

      comparisons.push({ id: crypto.randomUUID(), sourceIds: distinctSourceIds, relationship: item.relationship as SourceRelationship, description: item.description.trim() })
    }
  }

  const gaps: ResearchGap[] = []
  if (Array.isArray(obj.gaps)) {
    for (const raw of obj.gaps) {
      if (typeof raw !== 'object' || raw === null) continue
      const item = raw as Record<string, unknown>
      if (typeof item.description !== 'string' || !item.description.trim()) continue
      if (typeof item.reason !== 'string' || !VALID_GAP_REASONS.has(item.reason)) continue
      gaps.push({ id: crypto.randomUUID(), description: item.description.trim(), reason: item.reason as ResearchGapReason })
    }
  }

  const followUpQuestions = Array.isArray(obj.followUpQuestions)
    ? obj.followUpQuestions.filter((q): q is string => typeof q === 'string' && q.trim().length > 0).slice(0, MAX_FOLLOW_UP_QUESTIONS)
    : []

  return { keyFindings, synthesis: obj.synthesis.trim(), limitations, comparisons, gaps, followUpQuestions }
}
