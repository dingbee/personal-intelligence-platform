import { describe, expect, it } from 'vitest'
import { buildEvidenceInterpreterSystemPrompt } from '@/modules/research-intelligence/api/buildEvidenceInterpreterSystemPrompt'
import type { ResearchEvidence } from '@/modules/research-intelligence/researchInvestigation'

describe('buildEvidenceInterpreterSystemPrompt', () => {
  it('labels document, note, and asset evidence distinctly — never treating an image as automatically authoritative or unlabeled', () => {
    const evidence: ResearchEvidence[] = [
      { id: 'ev-1', source: { type: 'document', id: 'doc-1', title: 'Policy Doc' }, excerpt: 'Returns within 30 days.', similarity: 0.9 },
      { id: 'ev-2', source: { type: 'note', id: 'note-1', title: 'Ops notes' }, excerpt: 'South flagged.', similarity: 0.8 },
      { id: 'ev-3', source: { type: 'asset', id: 'asset-1', title: 'Q3 dashboard screenshot' }, excerpt: 'Q3 revenue trending upward.', similarity: 0.85 },
    ]

    const prompt = buildEvidenceInterpreterSystemPrompt({ question: 'What does Q3 look like?', evidence })

    expect(prompt).toContain('[1] (Document: "Policy Doc") Returns within 30 days.')
    expect(prompt).toContain('[2] (Note: "Ops notes") South flagged.')
    expect(prompt).toContain('[3] (Image: "Q3 dashboard screenshot") Q3 revenue trending upward.')
  })

  it('still instructs the model to only cite what is shown and use no outside knowledge, regardless of modality mix', () => {
    const evidence: ResearchEvidence[] = [{ id: 'ev-1', source: { type: 'asset', id: 'asset-1', title: 'Chart' }, excerpt: 'x', similarity: 0.5 }]
    const prompt = buildEvidenceInterpreterSystemPrompt({ question: 'q', evidence })
    expect(prompt).toContain('Do not use outside knowledge — only what is shown above.')
  })
})
