import { describe, expect, it } from 'vitest'
import { researchInvestigationToProvenance } from '@/shared/provenance/adapters/researchIntelligenceAdapter'
import { resolveEvidenceChain, toLookup } from '@/shared/provenance/resolveEvidenceChain'
import type { ResearchInvestigation } from '@/modules/research-intelligence/researchInvestigation'
import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'
import type { AnalyticalProvenance } from '@/modules/data-intelligence/analyticalPlan'

const provenance: AnalyticalProvenance = { documentId: 'doc-1', sheetName: 'Sales', sheetIndex: 0, totalRowsInDataset: 30, rowsMatchedAfterFilters: 6 }

const nestedAnalysis: AnalysisInvestigation = {
  id: 'analysis-inv-1',
  question: 'What is the return rate by region?',
  datasetId: 'dataset-1',
  steps: [
    {
      id: 'a-step-1',
      index: 0,
      purpose: 'baseline',
      triggeredBy: null,
      plan: { datasetId: 'dataset-1', measures: [] },
      result: { status: 'ok', plan: { datasetId: 'dataset-1', measures: [] }, rows: [], provenance },
      observations: [{ id: 'a-obs-1', stepId: 'a-step-1', statement: 'South rate = 0.26', value: 0.26, provenance }],
    },
  ],
  hypotheses: [],
  contradictions: [],
  synthesis: 'South has the highest observed return rate.',
  status: 'complete',
  stepLimitReached: false,
  declineReason: null,
}

function investigation(overrides: Partial<ResearchInvestigation> = {}): ResearchInvestigation {
  return {
    id: 'research-inv-1',
    question: 'Why are regional returns different?',
    scope: null,
    context: null,
    workspaceId: 'workspace-1',
    documentId: 'doc-1',
    steps: [
      {
        id: 'r-step-1',
        index: 0,
        kind: 'evidence_gathering',
        purpose: 'baseline evidence',
        triggeredBy: null,
        query: 'return policy',
        evidence: [{ id: 'ev-1', source: { type: 'document', id: 'doc-2', title: 'Returns Policy' }, excerpt: 'A 30-day window applies.', similarity: 0.9 }],
        observations: [{ id: 'r-obs-1', stepId: 'r-step-1', statement: 'A 30-day window applies.', evidenceIds: ['ev-1'] }],
        datasetInvestigation: null,
      },
      {
        id: 'r-step-2',
        index: 1,
        kind: 'dataset_investigation',
        purpose: 'quantify',
        triggeredBy: 'r-step-1',
        query: 'What is the return rate by region?',
        evidence: [{ id: 'analysis-inv-1', source: { type: 'dataset_investigation', id: 'analysis-inv-1', title: 'What is the return rate by region?' }, excerpt: 'South has the highest observed return rate.', similarity: null }],
        observations: [{ id: 'r-obs-2', stepId: 'r-step-2', statement: 'South rate = 0.26', evidenceIds: ['analysis-inv-1'] }],
        datasetInvestigation: nestedAnalysis,
      },
    ],
    hypotheses: [],
    comparisons: [],
    gaps: [],
    keyFindings: ['South rate = 0.26'],
    synthesis: 'South shows a higher observed return rate, consistent with policy evidence.',
    limitations: null,
    followUpQuestions: [],
    status: 'complete',
    stepLimitReached: false,
    synthesisFailed: false,
    declineReason: null,
    ...overrides,
  }
}

describe('researchInvestigationToProvenance', () => {
  it('maps each step\'s real ResearchEvidence, preserving verbatim excerpts and real source ids', () => {
    const chain = researchInvestigationToProvenance(investigation())
    const documentEvidence = chain.evidence.find((e) => e.id === 'ev-1')!
    expect(documentEvidence.source).toEqual({ type: 'document', id: 'doc-2', title: 'Returns Policy' })
    expect(documentEvidence.excerpt).toBe('A 30-day window applies.')
  })

  it('splices in the nested Analysis Intelligence provenance chain for a dataset_investigation step — a genuine cross-engine trace', () => {
    const chain = researchInvestigationToProvenance(investigation())
    // The nested chain's own calculation/observation derivations are present, not reimplemented.
    expect(chain.derivations.some((d) => d.id === 'analysis:a-step-1:calc' || d.kind === 'calculation')).toBe(true)
    expect(chain.derivations.some((d) => d.id === 'analysis:a-obs-1')).toBe(true)

    const researchSynthesis = chain.derivations.find((d) => d.id === 'research:research-inv-1:synthesis')!
    const resolved = resolveEvidenceChain(researchSynthesis.id, toLookup(chain))!
    // Following the research synthesis down should eventually reach the real Data Intelligence evidence three engines deep.
    const allSourceTypes = new Set<string>()
    function collect(node: typeof resolved) {
      for (const e of node.evidence) allSourceTypes.add(e.source.type)
      for (const p of node.priorDerivations) collect(p)
    }
    collect(resolved)
    expect(allSourceTypes.has('document')).toBe(true)
    expect(allSourceTypes.has('dataset')).toBe(true)
  })

  it('produces no synthesis derivation for a declined investigation with no steps', () => {
    const chain = researchInvestigationToProvenance(
      investigation({ status: 'declined', declineReason: 'no relevant content', synthesis: null, steps: [], keyFindings: [] }),
    )
    expect(chain.evidence).toEqual([])
    expect(chain.derivations).toEqual([])
  })
})
