import type { ResearchEvidence, ResearchObservation } from '@/modules/research-intelligence/researchInvestigation'

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1]!.trim() : trimmed
}

/**
 * Research Intelligence — parses the evidence-interpreter's response
 * into ResearchObservations, resolving each "evidenceIndexes" entry
 * back to a real ResearchEvidence.id. This is the enforcement point for
 * "never allow synthesis to invent unsupported observations": any
 * index that is not an integer in range, or an observation left with no
 * valid evidence id after filtering, is dropped entirely rather than
 * kept with a guessed/empty citation. A malformed response (not JSON,
 * wrong shape) degrades to zero observations, exactly like "no evidence
 * was relevant" — never an error that aborts the investigation, since a
 * failed interpretation of one step's evidence is not a fatal condition
 * (see runResearchInvestigation.ts).
 */
export function parseResearchObservationsResponse(rawText: string, stepId: string, evidence: ResearchEvidence[]): ResearchObservation[] {
  const text = stripCodeFences(rawText)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }

  if (typeof parsed !== 'object' || parsed === null) return []
  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj.observations)) return []

  const observations: ResearchObservation[] = []
  for (const raw of obj.observations) {
    if (typeof raw !== 'object' || raw === null) continue
    const item = raw as Record<string, unknown>
    if (typeof item.statement !== 'string' || !item.statement.trim()) continue
    if (!Array.isArray(item.evidenceIndexes)) continue

    const evidenceIds = item.evidenceIndexes
      .filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= evidence.length)
      .map((n) => evidence[n - 1]!.id)

    if (evidenceIds.length === 0) continue

    observations.push({ id: crypto.randomUUID(), stepId, statement: item.statement.trim(), evidenceIds: Array.from(new Set(evidenceIds)) })
  }

  return observations
}
