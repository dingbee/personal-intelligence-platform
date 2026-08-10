import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { useHasProIntelligenceMock, useGenerateWorkspaceBriefingMock } = vi.hoisted(() => ({
  useHasProIntelligenceMock: vi.fn(),
  useGenerateWorkspaceBriefingMock: vi.fn(),
}))

vi.mock('@/modules/plans/hooks/useHasProIntelligence', () => ({ useHasProIntelligence: useHasProIntelligenceMock }))
vi.mock('@/modules/workspace-intelligence/hooks/useGenerateWorkspaceBriefing', () => ({ useGenerateWorkspaceBriefing: useGenerateWorkspaceBriefingMock }))

import { WorkspaceBriefingCard } from '@/modules/workspace-intelligence/components/WorkspaceBriefingCard'

function renderCard() {
  return render(createElement(MemoryRouter, null, createElement(WorkspaceBriefingCard)))
}

afterEach(cleanup)

/**
 * Phase P1 Advanced AI Workspace — the UI-level Free/Pro gating (a UX
 * hint only; runCapability is the real boundary, tested separately in
 * generateWorkspaceBriefing.test.ts) plus loading/error/result states.
 */
describe('WorkspaceBriefingCard', () => {
  let mutateAsyncMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mutateAsyncMock = vi.fn()
    useGenerateWorkspaceBriefingMock.mockReturnValue({ mutateAsync: mutateAsyncMock, isPending: false, isError: false, error: null })
  })

  it('shows a locked/upgrade state for a Free user, with no generate button', () => {
    useHasProIntelligenceMock.mockReturnValue({ data: false, isLoading: false })

    renderCard()

    expect(screen.getByText(/Pro Intelligence capability/i)).not.toBeNull()
    expect(screen.getByRole('link', { name: /upgrade to pro/i })).not.toBeNull()
    expect(screen.queryByRole('button', { name: /generate workspace briefing/i })).toBeNull()
  })

  it('shows the generate button for a Pro-entitled user', () => {
    useHasProIntelligenceMock.mockReturnValue({ data: true, isLoading: false })

    renderCard()

    expect(screen.getByRole('button', { name: /generate workspace briefing/i })).not.toBeNull()
  })

  it('shows the generate button for a Founding Pro-entitled user identically', () => {
    useHasProIntelligenceMock.mockReturnValue({ data: true, isLoading: false })

    renderCard()

    expect(screen.getByRole('button', { name: /generate workspace briefing/i })).not.toBeNull()
  })

  it('generating shows the briefing content and a link to the saved note', async () => {
    useHasProIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    mutateAsyncMock.mockResolvedValueOnce({ title: 'Workspace Briefing: Acme Launch', content: 'This workspace is working on the Acme launch.' })

    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /generate workspace briefing/i }))

    expect(await screen.findByText('This workspace is working on the Acme launch.')).not.toBeNull()
    expect(screen.getByRole('link', { name: /saved to notes/i })).not.toBeNull()
  })

  it('a failed generation surfaces the real error, not a false success', () => {
    useHasProIntelligenceMock.mockReturnValue({ data: true, isLoading: false })
    useGenerateWorkspaceBriefingMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
      isError: true,
      error: new Error('No active plan or storage quota configured for your account.'),
    })

    renderCard()

    expect(screen.getByText('No active plan or storage quota configured for your account.')).not.toBeNull()
  })
})
