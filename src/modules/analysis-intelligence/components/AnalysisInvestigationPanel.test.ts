import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { useHasAnalysisIntelligenceMock, useStructuredDatasetsMock, useAnalysisInvestigationMock } = vi.hoisted(() => ({
  useHasAnalysisIntelligenceMock: vi.fn(),
  useStructuredDatasetsMock: vi.fn(),
  useAnalysisInvestigationMock: vi.fn(),
}))

vi.mock('@/modules/plans/hooks/useHasAnalysisIntelligence', () => ({ useHasAnalysisIntelligence: useHasAnalysisIntelligenceMock }))
vi.mock('@/modules/data-intelligence/hooks/useStructuredDatasets', () => ({ useStructuredDatasets: useStructuredDatasetsMock }))
vi.mock('@/modules/analysis-intelligence/hooks/useAnalysisInvestigation', () => ({ useAnalysisInvestigation: useAnalysisInvestigationMock }))

import { AnalysisInvestigationPanel } from '@/modules/analysis-intelligence/components/AnalysisInvestigationPanel'
import type { AnalysisInvestigation } from '@/modules/analysis-intelligence/analysisInvestigation'

function renderPanel() {
  return render(createElement(MemoryRouter, null, createElement(AnalysisInvestigationPanel, { documentId: 'doc-1', workspaceId: null })))
}

const oneDataset = [{ id: 'ds-1', sheetIndex: 0, sheetName: 'Sales', rowCount: 30, columnCount: 14 }]

afterEach(cleanup)

describe('AnalysisInvestigationPanel', () => {
  let mutateAsyncMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsyncMock = vi.fn()
    useAnalysisInvestigationMock.mockReturnValue({ mutateAsync: mutateAsyncMock, isPending: false, isError: false, error: null })
  })

  it('renders nothing while datasets are loading, or when there are none', () => {
    useHasAnalysisIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: undefined, isLoading: true })
    expect(renderPanel().container.firstChild).toBeNull()
    cleanup()

    useStructuredDatasetsMock.mockReturnValue({ data: [], isLoading: false })
    expect(renderPanel().container.firstChild).toBeNull()
  })

  it('shows a locked/upgrade state for a Free user, with no question input', () => {
    useHasAnalysisIntelligenceMock.mockReturnValue({ data: false, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: oneDataset, isLoading: false })

    renderPanel()

    expect(screen.getByText(/Pro Intelligence capability/i)).not.toBeNull()
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).not.toBeNull()
    expect(screen.queryByRole('button', { name: /investigate/i })).toBeNull()
  })

  it('shows the question input and Investigate button for an entitled user', () => {
    useHasAnalysisIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: oneDataset, isLoading: false })

    renderPanel()

    expect(screen.getByPlaceholderText(/return rate/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: /investigate/i })).not.toBeNull()
  })

  it('submitting a question shows real step-by-step progress and the final synthesis, distinguishing evidence from interpretation', async () => {
    useHasAnalysisIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: oneDataset, isLoading: false })

    const provenance = { documentId: 'doc-1', sheetName: 'Sales', sheetIndex: 0, totalRowsInDataset: 30, rowsMatchedAfterFilters: 30 }
    const plan = { datasetId: 'ds-1', dimensions: [{ column: 'Region' }], measures: [{ as: 'rate', aggregation: 'ratio' as const, ratio: { numerator: { aggregation: 'count' as const }, denominator: { aggregation: 'count' as const } } }] }
    const completedInvestigation: AnalysisInvestigation = {
      id: 'inv-1',
      question: 'Why is South high?',
      datasetId: 'ds-1',
      steps: [
        {
          id: 's1',
          index: 0,
          purpose: 'baseline: return rate by region',
          triggeredBy: null,
          plan,
          result: { status: 'ok', plan, rows: [{ dimensions: { Region: 'South' }, measures: { rate: 0.26 } }], provenance },
          observations: [{ id: 'o1', stepId: 's1', statement: 'Region=South — rate=0.26', value: 0.26, provenance }],
        },
      ],
      hypotheses: [],
      contradictions: [],
      synthesis: 'South shows a higher observed return rate than other regions in this dataset.',
      status: 'complete',
      stepLimitReached: false,
      declineReason: null,
    }
    mutateAsyncMock.mockResolvedValueOnce({ investigation: completedInvestigation })

    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/return rate/i), { target: { value: 'Why is South high?' } })
    fireEvent.click(screen.getByRole('button', { name: /investigate/i }))

    expect(await screen.findByText(/Region=South — rate=0.26/)).not.toBeNull()
    expect(await screen.findByText('South shows a higher observed return rate than other regions in this dataset.')).not.toBeNull()
    expect(mutateAsyncMock).toHaveBeenCalledWith(expect.objectContaining({ question: 'Why is South high?' }))
  })

  it('shows the decline reason plainly for a declined investigation, never a fabricated synthesis', async () => {
    useHasAnalysisIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: oneDataset, isLoading: false })
    const declined: AnalysisInvestigation = {
      id: 'inv-1', question: 'What is customer sentiment?', datasetId: 'ds-1', steps: [], hypotheses: [], contradictions: [],
      synthesis: null, status: 'declined', stepLimitReached: false, declineReason: 'No column relates to customer sentiment.',
    }
    mutateAsyncMock.mockResolvedValueOnce({ investigation: declined })

    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/return rate/i), { target: { value: 'What is customer sentiment?' } })
    fireEvent.click(screen.getByRole('button', { name: /investigate/i }))

    expect(await screen.findByText('No column relates to customer sentiment.')).not.toBeNull()
  })

  it('a failed mutation surfaces the real error, not a false success', () => {
    useHasAnalysisIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: oneDataset, isLoading: false })
    useAnalysisInvestigationMock.mockReturnValue({ mutateAsync: mutateAsyncMock, isPending: false, isError: true, error: new Error('Analysis Investigation requires an upgraded plan.') })

    renderPanel()

    expect(screen.getByText('Analysis Investigation requires an upgraded plan.')).not.toBeNull()
  })
})
