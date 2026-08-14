import type { Action, ActionContextSource, ActionContextSourceType, ActionSet } from '@/modules/action-intelligence/action'
import type { DerivationReference, EvidenceReference, ProvenanceChain, SourceReference, SourceType } from '@/shared/provenance/types'

// ActionSet.contextEvidence's own ActionContextSourceType ('document'|'note'|'asset') maps 1:1
// onto the shared model's own SourceType, identical to the Planning/Decision adapters' mapping.
const SOURCE_TYPE_MAP: Record<ActionContextSourceType, SourceType> = { document: 'document', note: 'note', asset: 'asset' }

function toSourceReference(source: ActionContextSource): SourceReference {
  return { type: SOURCE_TYPE_MAP[source.type], id: source.id, title: source.title }
}

/**
 * Action Intelligence -> shared provenance adapter, mirroring
 * decisionIntelligenceAdapter.ts's own structure. Every real retrieved
 * passage becomes an EvidenceReference; every action whose description
 * actually cites evidence becomes an 'observation' derivation naming
 * that action's own title as the statement — an action with no cited
 * evidence contributes no derivation at all (never grounded in
 * nothing), the same invariant every other adapter in this codebase
 * upholds. There is no single closing 'synthesis' derivation the way
 * Plan/Decision each have one — an ActionSet's actions are siblings,
 * not steps converging on one final answer, so one observation per
 * evidence-backed action is the honest shape here.
 */
export function actionSetToProvenance(actionSet: ActionSet): ProvenanceChain {
  const evidence: EvidenceReference[] = actionSet.contextEvidence.map((item) => ({
    id: item.id,
    source: toSourceReference(item),
    location: { kind: 'whole' },
    excerpt: item.excerpt,
    retrievedAt: null,
  }))

  const derivations: DerivationReference[] = []
  for (const action of actionSet.actions) {
    if (action.evidenceIds.length === 0) continue
    derivations.push({
      id: `action:${action.id}`,
      kind: 'interpretation',
      evidenceIds: action.evidenceIds,
      basedOnDerivationIds: [],
      statement: `${action.title}: ${action.description}`,
      method: null,
    })
  }

  return { evidence, derivations }
}

/** Per-action helper for UI/detail surfaces that want just one action's own provenance slice rather than the whole set's. */
export function actionToProvenance(action: Action, contextEvidence: ActionContextSource[]): ProvenanceChain {
  const relevantSources = contextEvidence.filter((s) => action.evidenceIds.includes(s.id))
  return actionSetToProvenance({
    id: 'single-action',
    title: action.title,
    objective: null,
    status: 'complete',
    actions: [action],
    contextEvidence: relevantSources,
    validationIssues: [],
    budgetExhausted: false,
    generationFailed: false,
    declineReason: null,
    workspaceId: null,
    createdAt: action.id,
  })
}
