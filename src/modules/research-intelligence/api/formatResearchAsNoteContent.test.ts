import { describe, expect, it } from 'vitest'
import { formatResearchAsNoteContent } from '@/modules/research-intelligence/api/formatResearchAsNoteContent'
import type { ResearchInvestigation } from '@/modules/research-intelligence/researchInvestigation'

function baseInvestigation(overrides: Partial<ResearchInvestigation> = {}): ResearchInvestigation {
  return {
    id: 'inv-1', question: 'Q', scope: null, context: null, workspaceId: null, documentId: null,
    steps: [], hypotheses: [], comparisons: [], gaps: [], keyFindings: [], synthesis: null, limitations: null,
    followUpQuestions: [], status: 'in_progress', stepLimitReached: false, synthesisFailed: false, declineReason: null,
    ...overrides,
  }
}

describe('formatResearchAsNoteContent', () => {
  it('shows the decline reason plainly for a declined investigation, never a fabricated write-up', () => {
    const content = formatResearchAsNoteContent(baseInvestigation({ status: 'declined', declineReason: 'No library content on this topic.' }))
    expect(content).toContain('No library content on this topic.')
  })

  it('includes findings, synthesis, sources, limitations, gaps, and follow-ups for a complete investigation', () => {
    const content = formatResearchAsNoteContent(
      baseInvestigation({
        status: 'complete',
        keyFindings: ['South has a higher observed return rate.'],
        synthesis: 'South shows a higher rate than other regions.',
        limitations: 'Only one quarter of data was available.',
        gaps: [{ id: 'g1', description: 'No data on customer demographics.', reason: 'missing_variable' }],
        followUpQuestions: ['What drives the South regional difference?'],
        steps: [
          { id: 's1', index: 0, kind: 'evidence_gathering', purpose: 'p', triggeredBy: null, query: 'q', datasetInvestigation: null,
            evidence: [{ id: 'e1', source: { type: 'document', id: 'doc-1', title: 'Returns Report' }, excerpt: 'x', similarity: 0.9 }], observations: [] },
        ],
      }),
    )
    expect(content).toContain('South has a higher observed return rate.')
    expect(content).toContain('South shows a higher rate than other regions.')
    expect(content).toContain('Returns Report')
    expect(content).toContain('Only one quarter of data was available.')
    expect(content).toContain('Missing variable')
    expect(content).toContain('What drives the South regional difference?')
  })

  it('notes a synthesis failure plainly rather than showing an empty synthesis section', () => {
    const content = formatResearchAsNoteContent(baseInvestigation({ status: 'complete', synthesisFailed: true }))
    expect(content).toContain('could not be generated')
  })

  it('notes when investigation depth was limited', () => {
    const content = formatResearchAsNoteContent(baseInvestigation({ status: 'complete', synthesis: 'x', stepLimitReached: true }))
    expect(content).toContain('limited by the research step budget')
  })
})
