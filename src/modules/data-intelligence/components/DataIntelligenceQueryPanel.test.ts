import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { useHasDataIntelligenceMock, useStructuredDatasetsMock, useDataIntelligenceQueryMock } = vi.hoisted(() => ({
  useHasDataIntelligenceMock: vi.fn(),
  useStructuredDatasetsMock: vi.fn(),
  useDataIntelligenceQueryMock: vi.fn(),
}))

vi.mock('@/modules/plans/hooks/useHasDataIntelligence', () => ({ useHasDataIntelligence: useHasDataIntelligenceMock }))
vi.mock('@/modules/data-intelligence/hooks/useStructuredDatasets', () => ({ useStructuredDatasets: useStructuredDatasetsMock }))
vi.mock('@/modules/data-intelligence/hooks/useDataIntelligenceQuery', () => ({ useDataIntelligenceQuery: useDataIntelligenceQueryMock }))

import { DataIntelligenceQueryPanel } from '@/modules/data-intelligence/components/DataIntelligenceQueryPanel'

function renderPanel() {
  return render(createElement(MemoryRouter, null, createElement(DataIntelligenceQueryPanel, { documentId: 'doc-1', workspaceId: null })))
}

const oneDataset = [{ id: 'ds-1', sheetIndex: 0, sheetName: 'Sales', rowCount: 30, columnCount: 14 }]
const twoDatasets = [...oneDataset, { id: 'ds-2', sheetIndex: 1, sheetName: 'Returns', rowCount: 5, columnCount: 4 }]

afterEach(cleanup)

describe('DataIntelligenceQueryPanel', () => {
  let mutateAsyncMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsyncMock = vi.fn()
    useDataIntelligenceQueryMock.mockReturnValue({ mutateAsync: mutateAsyncMock, isPending: false, isError: false, error: null })
  })

  it('renders nothing while datasets are loading', () => {
    useHasDataIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: undefined, isLoading: true })

    const { container } = renderPanel()
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the document has no persisted structured dataset', () => {
    useHasDataIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: [], isLoading: false })

    const { container } = renderPanel()
    expect(container.firstChild).toBeNull()
  })

  it('shows a locked/upgrade state for a Free user, with no input or Ask button', () => {
    useHasDataIntelligenceMock.mockReturnValue({ data: false, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: oneDataset, isLoading: false })

    renderPanel()

    expect(screen.getByText(/Pro Intelligence capability/i)).not.toBeNull()
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).not.toBeNull()
    expect(screen.queryByRole('button', { name: /ask/i })).toBeNull()
  })

  it('shows the question input and Ask button for an entitled user with one dataset (no sheet picker)', () => {
    useHasDataIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: oneDataset, isLoading: false })

    renderPanel()

    expect(screen.getByPlaceholderText(/salesperson generated/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: /ask/i })).not.toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('shows a sheet picker when the document has more than one structured dataset', () => {
    useHasDataIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: twoDatasets, isLoading: false })

    renderPanel()

    expect(screen.getByRole('combobox')).not.toBeNull()
  })

  it('submitting a question calls the mutation and displays the answered result', async () => {
    useHasDataIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: oneDataset, isLoading: false })
    mutateAsyncMock.mockResolvedValueOnce({ status: 'answered', question: 'Who sold the most?', answer: 'Alice sold the most.', reason: null, result: null })

    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/salesperson generated/i), { target: { value: 'Who sold the most?' } })
    fireEvent.click(screen.getByRole('button', { name: /ask/i }))

    expect(await screen.findByText('Alice sold the most.')).not.toBeNull()
    expect(mutateAsyncMock).toHaveBeenCalledWith('Who sold the most?')
  })

  it('displays the reason plainly for a declined outcome, not a fabricated answer', async () => {
    useHasDataIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: oneDataset, isLoading: false })
    mutateAsyncMock.mockResolvedValueOnce({ status: 'declined', question: 'What is our brand sentiment?', answer: null, reason: 'This dataset has no column related to sentiment.', result: null })

    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/salesperson generated/i), { target: { value: 'What is our brand sentiment?' } })
    fireEvent.click(screen.getByRole('button', { name: /ask/i }))

    expect(await screen.findByText('This dataset has no column related to sentiment.')).not.toBeNull()
  })

  it('a failed query surfaces the real error, not a false success', () => {
    useHasDataIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useStructuredDatasetsMock.mockReturnValue({ data: oneDataset, isLoading: false })
    useDataIntelligenceQueryMock.mockReturnValue({ mutateAsync: mutateAsyncMock, isPending: false, isError: true, error: new Error('Data Intelligence Query requires an upgraded plan.') })

    renderPanel()

    expect(screen.getByText('Data Intelligence Query requires an upgraded plan.')).not.toBeNull()
  })
})
