import { describe, expect, it } from 'vitest'
import { resolveEvidenceChain, toLookup } from '@/shared/provenance/resolveEvidenceChain'
import type { DerivationReference, EvidenceReference, ProvenanceChain } from '@/shared/provenance/types'

const baseEvidence: EvidenceReference = { id: 'ev-1', source: { type: 'dataset', id: 'doc-1', title: 'Sales' }, location: { kind: 'whole' }, excerpt: null, retrievedAt: null }
const calcDerivation: DerivationReference = { id: 'd-calc', kind: 'calculation', evidenceIds: ['ev-1'], basedOnDerivationIds: [], statement: 'South rate = 0.26', method: 'ratio' }
const observationDerivation: DerivationReference = { id: 'd-obs', kind: 'observation', evidenceIds: ['ev-1'], basedOnDerivationIds: ['d-calc'], statement: 'South is highest', method: null }
const synthesisDerivation: DerivationReference = { id: 'd-synth', kind: 'synthesis', evidenceIds: [], basedOnDerivationIds: ['d-obs'], statement: 'South shows a higher observed rate', method: null }

const chain: ProvenanceChain = { evidence: [baseEvidence], derivations: [calcDerivation, observationDerivation, synthesisDerivation] }

describe('resolveEvidenceChain', () => {
  it('reconstructs a full source -> evidence -> derivation -> conclusion chain', () => {
    const resolved = resolveEvidenceChain('d-synth', toLookup(chain))
    expect(resolved).not.toBeNull()
    expect(resolved!.derivation.statement).toBe('South shows a higher observed rate')
    expect(resolved!.evidence).toEqual([])
    expect(resolved!.priorDerivations).toHaveLength(1)

    const observation = resolved!.priorDerivations[0]!
    expect(observation.derivation.statement).toBe('South is highest')
    expect(observation.evidence).toEqual([baseEvidence])
    expect(observation.priorDerivations).toHaveLength(1)

    const calculation = observation.priorDerivations[0]!
    expect(calculation.derivation.statement).toBe('South rate = 0.26')
    expect(calculation.evidence).toEqual([baseEvidence])
    expect(calculation.derivation.evidenceIds[0]).toBe(baseEvidence.id)
    expect(calculation.evidence[0]!.source).toEqual({ type: 'dataset', id: 'doc-1', title: 'Sales' })
  })

  it('returns null for an unknown derivation id', () => {
    expect(resolveEvidenceChain('does-not-exist', toLookup(chain))).toBeNull()
  })

  it('drops a dangling evidenceId or basedOnDerivationId rather than throwing or fabricating', () => {
    const withDangling: ProvenanceChain = {
      evidence: [baseEvidence],
      derivations: [{ id: 'd-x', kind: 'observation', evidenceIds: ['ev-1', 'ev-missing'], basedOnDerivationIds: ['d-missing'], statement: 'x', method: null }],
    }
    const resolved = resolveEvidenceChain('d-x', toLookup(withDangling))
    expect(resolved).not.toBeNull()
    expect(resolved!.evidence).toEqual([baseEvidence])
    expect(resolved!.priorDerivations).toEqual([])
  })

  it('never infinitely recurses on a cyclic basedOnDerivationIds graph', () => {
    const cyclic: ProvenanceChain = {
      evidence: [],
      derivations: [
        { id: 'a', kind: 'observation', evidenceIds: [], basedOnDerivationIds: ['b'], statement: 'a', method: null },
        { id: 'b', kind: 'observation', evidenceIds: [], basedOnDerivationIds: ['a'], statement: 'b', method: null },
      ],
    }
    const resolved = resolveEvidenceChain('a', toLookup(cyclic))
    expect(resolved).not.toBeNull()
  })
})
