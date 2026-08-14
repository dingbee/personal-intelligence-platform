import type { DerivationReference, EvidenceChain, EvidenceReference, ProvenanceChain } from '@/shared/provenance/types'

/** Builds the Map-based lookup resolveEvidenceChain needs from the flat arrays every adapters/*.ts function returns. */
export function toLookup(chain: ProvenanceChain): { evidence: Map<string, EvidenceReference>; derivations: Map<string, DerivationReference> } {
  return {
    evidence: new Map(chain.evidence.map((e) => [e.id, e])),
    derivations: new Map(chain.derivations.map((d) => [d.id, d])),
  }
}

/**
 * Recursion depth cap — mirrors the bounded-investigation discipline
 * already established by MAX_INVESTIGATION_STEPS/MAX_RESEARCH_STEPS
 * (see docs/post-p2-intelligence-architecture-reassessment.md §12): a
 * malformed or accidentally-cyclic `basedOnDerivationIds` graph must
 * never cause unbounded recursion. In practice the real chains this
 * sprint's adapters build are at most 3 levels deep (Data calculation ->
 * Analysis observation -> Research synthesis), so this cap is a safety
 * backstop, not an expected limit.
 */
const MAX_CHAIN_DEPTH = 10

/**
 * Provenance Foundation — the one traceability primitive the Post-P2
 * Architecture Reassessment asked for ("given an observation/conclusion,
 * determine its originating source, evidence, derivation"), implemented
 * as a pure function over in-memory lookups rather than a new database
 * service: every caller (Data/Analysis/Research Intelligence, Knowledge
 * Intelligence) already holds its own investigation/result/evidence
 * objects in memory by the time it would want to trace one, so no new
 * fetch is introduced here.
 *
 * Dangling references are dropped, never fabricated or thrown on: an
 * `evidenceId`/`basedOnDerivationId` not present in the supplied lookup
 * is simply skipped, the same defensive discipline
 * parseResearchObservationsResponse.ts and parseResearchSynthesisResponse.ts
 * already apply to AI-proposed citations — a chain missing one input is
 * still a real (partial) chain, never a crash and never a guessed link.
 */
export function resolveEvidenceChain(
  derivationId: string,
  lookup: { evidence: Map<string, EvidenceReference>; derivations: Map<string, DerivationReference> },
): EvidenceChain | null {
  return resolveInner(derivationId, lookup, 0)
}

function resolveInner(
  derivationId: string,
  lookup: { evidence: Map<string, EvidenceReference>; derivations: Map<string, DerivationReference> },
  depth: number,
): EvidenceChain | null {
  const derivation = lookup.derivations.get(derivationId)
  if (!derivation) return null

  const evidence = derivation.evidenceIds.map((id) => lookup.evidence.get(id)).filter((e): e is EvidenceReference => Boolean(e))

  const priorDerivations =
    depth >= MAX_CHAIN_DEPTH
      ? []
      : derivation.basedOnDerivationIds
          .map((id) => resolveInner(id, lookup, depth + 1))
          .filter((chain): chain is EvidenceChain => Boolean(chain))

  return { derivation, evidence, priorDerivations }
}
