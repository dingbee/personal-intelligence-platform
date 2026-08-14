import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { useHasResearchIntelligenceMock, useDocumentsMock, useWorkspaceMock, useResearchInvestigationMock, useSaveResearchToNoteMock } = vi.hoisted(() => ({
  useHasResearchIntelligenceMock: vi.fn(),
  useDocumentsMock: vi.fn(),
  useWorkspaceMock: vi.fn(),
  useResearchInvestigationMock: vi.fn(),
  useSaveResearchToNoteMock: vi.fn(),
}))

vi.mock('@/modules/plans/hooks/useHasResearchIntelligence', () => ({ useHasResearchIntelligence: useHasResearchIntelligenceMock }))
vi.mock('@/modules/library/hooks/useDocuments', () => ({ useDocuments: useDocumentsMock }))
vi.mock('@/modules/workspaces/useWorkspace', () => ({ useWorkspace: useWorkspaceMock }))
vi.mock('@/modules/research-intelligence/hooks/useResearchInvestigation', () => ({ useResearchInvestigation: useResearchInvestigationMock }))
vi.mock('@/modules/research-intelligence/hooks/useSaveResearchToNote', () => ({ useSaveResearchToNote: useSaveResearchToNoteMock }))

import { ResearchPage } from '@/modules/research-intelligence/pages/ResearchPage'
import type { ResearchInvestigation } from '@/modules/research-intelligence/researchInvestigation'

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(ResearchPage)))
}

afterEach(cleanup)

describe('ResearchPage', () => {
  let mutateAsyncMock: ReturnType<typeof vi.fn>
  let saveMutateMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceMock.mockReturnValue({ currentWorkspaceId: 'workspace-1' })
    useDocumentsMock.mockReturnValue({ data: [] })
    mutateAsyncMock = vi.fn()
    saveMutateMock = vi.fn()
    useResearchInvestigationMock.mockReturnValue({ mutateAsync: mutateAsyncMock, isPending: false, isError: false, error: null })
    useSaveResearchToNoteMock.mockReturnValue({ mutate: saveMutateMock, isPending: false, isSuccess: false, isError: false, error: null, reset: vi.fn() })
  })

  it('shows a locked/upgrade state for a Free user, with no question input', () => {
    useHasResearchIntelligenceMock.mockReturnValue({ data: false, isLoading: false })
    renderPage()

    expect(screen.getByText(/Pro Intelligence capability/i)).not.toBeNull()
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).not.toBeNull()
    expect(screen.queryByRole('button', { name: /investigate/i })).toBeNull()
  })

  it('shows the question input and Investigate button for an entitled user', () => {
    useHasResearchIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    renderPage()

    expect(screen.getByPlaceholderText(/associated with higher return rates/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: /investigate/i })).not.toBeNull()
  })

  it('submitting a question shows real step-by-step progress, sources, and synthesis, distinguishing evidence from interpretation', async () => {
    useHasResearchIntelligenceMock.mockReturnValue({ data: true, isLoading: false })

    const evidence = { id: 'e1', source: { type: 'document' as const, id: 'doc-1', title: 'Returns Policy' }, excerpt: 'x', similarity: 0.9 }
    const completed: ResearchInvestigation = {
      id: 'inv-1', question: 'Why is South high?', scope: null, context: null, workspaceId: 'workspace-1', documentId: null,
      steps: [{ id: 's1', index: 0, kind: 'evidence_gathering', purpose: 'baseline', triggeredBy: null, query: 'return policy', evidence: [evidence], observations: [{ id: 'o1', stepId: 's1', statement: 'A 30-day window applies.', evidenceIds: ['e1'] }], datasetInvestigation: null }],
      hypotheses: [], comparisons: [], gaps: [], keyFindings: ['A 30-day window applies.'],
      synthesis: 'South shows a higher observed return rate in this dataset.', limitations: 'Only one quarter of data.',
      followUpQuestions: ['What else could explain it?'], status: 'complete', stepLimitReached: false, synthesisFailed: false, declineReason: null,
    }
    mutateAsyncMock.mockResolvedValueOnce({ investigation: completed })

    renderPage()
    fireEvent.change(screen.getByPlaceholderText(/associated with higher return rates/i), { target: { value: 'Why is South high?' } })
    fireEvent.click(screen.getByRole('button', { name: /investigate/i }))

    expect(await screen.findByText('A 30-day window applies.')).not.toBeNull()
    expect(await screen.findByText('South shows a higher observed return rate in this dataset.')).not.toBeNull()
    expect(screen.getByText('Returns Policy')).not.toBeNull()
    expect(mutateAsyncMock).toHaveBeenCalledWith(expect.objectContaining({ question: 'Why is South high?' }))
  })

  it('Multimodal Evidence Integration: distinguishes image evidence from document evidence in the Sources consulted list', async () => {
    useHasResearchIntelligenceMock.mockReturnValue({ data: true, isLoading: false })

    const docEvidence = { id: 'e1', source: { type: 'document' as const, id: 'doc-1', title: 'Returns Policy' }, excerpt: 'x', similarity: 0.9 }
    const assetEvidence = { id: 'e2', source: { type: 'asset' as const, id: 'asset-1', title: 'Q3 dashboard screenshot' }, excerpt: 'y', similarity: 0.8 }
    const completed: ResearchInvestigation = {
      id: 'inv-1', question: 'What does the dashboard show?', scope: null, context: null, workspaceId: 'workspace-1', documentId: null,
      steps: [{ id: 's1', index: 0, kind: 'evidence_gathering', purpose: 'baseline', triggeredBy: null, query: 'dashboard', evidence: [docEvidence, assetEvidence], observations: [{ id: 'o1', stepId: 's1', statement: 'Revenue trended upward.', evidenceIds: ['e2'] }], datasetInvestigation: null }],
      hypotheses: [], comparisons: [], gaps: [], keyFindings: ['Revenue trended upward.'],
      synthesis: 'Revenue trended upward per the dashboard screenshot.', limitations: null,
      followUpQuestions: [], status: 'complete', stepLimitReached: false, synthesisFailed: false, declineReason: null,
    }
    mutateAsyncMock.mockResolvedValueOnce({ investigation: completed })

    renderPage()
    fireEvent.change(screen.getByPlaceholderText(/associated with higher return rates/i), { target: { value: 'What does the dashboard show?' } })
    fireEvent.click(screen.getByRole('button', { name: /investigate/i }))

    expect(await screen.findByText('Returns Policy')).not.toBeNull()
    expect(screen.getByText('Q3 dashboard screenshot')).not.toBeNull()
    expect(screen.getByText('[Document]')).not.toBeNull()
    expect(screen.getByText('[Image]')).not.toBeNull()
  })

  it('shows the decline reason plainly for a declined investigation, never a fabricated synthesis', async () => {
    useHasResearchIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    const declined: ResearchInvestigation = {
      id: 'inv-1', question: 'q', scope: null, context: null, workspaceId: 'workspace-1', documentId: null,
      steps: [], hypotheses: [], comparisons: [], gaps: [], keyFindings: [], synthesis: null, limitations: null,
      followUpQuestions: [], status: 'declined', stepLimitReached: false, synthesisFailed: false, declineReason: 'This library has no content about live competitor pricing.',
    }
    mutateAsyncMock.mockResolvedValueOnce({ investigation: declined })

    renderPage()
    fireEvent.change(screen.getByPlaceholderText(/associated with higher return rates/i), { target: { value: 'q' } })
    fireEvent.click(screen.getByRole('button', { name: /investigate/i }))

    expect(await screen.findByText('This library has no content about live competitor pricing.')).not.toBeNull()
  })

  it('a failed mutation surfaces the real error, not a false success', () => {
    useHasResearchIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useResearchInvestigationMock.mockReturnValue({ mutateAsync: mutateAsyncMock, isPending: false, isError: true, error: new Error('Research Investigation requires an upgraded plan.') })

    renderPage()

    expect(screen.getByText('Research Investigation requires an upgraded plan.')).not.toBeNull()
  })
})
