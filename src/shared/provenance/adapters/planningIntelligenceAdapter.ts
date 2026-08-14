import type { Plan, PlanContextSource, PlanContextSourceType } from '@/modules/planning-intelligence/plan'
import type { DerivationReference, EvidenceReference, ProvenanceChain, SourceReference, SourceType } from '@/shared/provenance/types'

// Plan.contextEvidence's own PlanContextSourceType ('document'|'note'|'asset') maps 1:1 onto
// the shared model's own SourceType — no new tag needed (mirrors researchIntelligenceAdapter.ts's
// own 1:1 mapping for the same two types).
const SOURCE_TYPE_MAP: Record<PlanContextSourceType, SourceType> = { document: 'document', note: 'note', asset: 'asset' }

function toSourceReference(source: PlanContextSource): SourceReference {
  return { type: SOURCE_TYPE_MAP[source.type], id: source.id, title: source.title }
}

/**
 * Planning Intelligence -> shared provenance adapter. Every
 * PlanContextSource the planner actually saw becomes an EvidenceReference
 * (verbatim excerpt, never paraphrased). Unlike Research Intelligence's
 * per-observation citations, the planning-generate-plan capability was
 * not asked to cite which specific passage grounds which specific
 * milestone/task/assumption (a per-claim citation prompt would add
 * complexity out of proportion to a single-pass planning call) — so this
 * adapter produces one plan-level 'synthesis' derivation citing ALL of
 * the plan's context evidence collectively, rather than fabricating
 * finer-grained citations the capability never actually made. This
 * mirrors the shared model's own invariant (a derivation must cite real
 * evidence or a real prior derivation): when a plan had no real context
 * evidence at all (empty library, or the objective matched nothing), no
 * derivation is produced — an empty ProvenanceChain is the honest
 * answer, not a derivation grounded in nothing.
 */
export function planToProvenance(plan: Plan): ProvenanceChain {
  const evidence: EvidenceReference[] = plan.contextEvidence.map((item) => ({
    id: item.id,
    source: toSourceReference(item),
    location: { kind: 'whole' },
    excerpt: item.excerpt,
    retrievedAt: null,
  }))

  const derivations: DerivationReference[] = []
  if (evidence.length > 0 && plan.status === 'complete') {
    derivations.push({
      id: `planning:${plan.id}:synthesis`,
      kind: 'synthesis',
      evidenceIds: evidence.map((e) => e.id),
      basedOnDerivationIds: [],
      statement: plan.gapAnalysis ?? plan.description ?? plan.title,
      method: null,
    })
  }

  return { evidence, derivations }
}
