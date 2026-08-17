import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * V1 Launch Hardening, Workstream 2 — WorkspaceIntelligenceHubPage
 * previously destructured `useWorkspaceHub()` without reading `isError`,
 * so a failed/retry-exhausted query rendered nothing below the greeting
 * (`!data ? null`). The Hub is the default landing page for any user with
 * a workspace (HomeRedirect.tsx), so this pins the fix: a query failure
 * now shows an explicit error state with a working Retry action, and
 * every other branch (loading, zero-data success) is unchanged.
 */

const {
  useWorkspaceHubMock,
  useWorkspaceMock,
  useGreetingMock,
  useCommandContextMock,
  useCommandActionsMock,
  useWorkspaceMemberDirectoryMock,
  useDismissedSuggestionsMock,
} = vi.hoisted(() => ({
  useWorkspaceHubMock: vi.fn(),
  useWorkspaceMock: vi.fn(),
  useGreetingMock: vi.fn(),
  useCommandContextMock: vi.fn(),
  useCommandActionsMock: vi.fn(),
  useWorkspaceMemberDirectoryMock: vi.fn(),
  useDismissedSuggestionsMock: vi.fn(),
}))

vi.mock('@/modules/hub/hooks/useWorkspaceHub', () => ({ useWorkspaceHub: useWorkspaceHubMock }))
vi.mock('@/modules/workspaces/useWorkspace', () => ({ useWorkspace: useWorkspaceMock }))
vi.mock('@/modules/greeting/hooks/useGreeting', () => ({ useGreeting: useGreetingMock }))
vi.mock('@/modules/commands/hooks/useCommandContext', () => ({ useCommandContext: useCommandContextMock }))
vi.mock('@/modules/commands/hooks/useCommandActions', () => ({ useCommandActions: useCommandActionsMock }))
vi.mock('@/modules/workspaces/hooks/useWorkspaceMemberDirectory', () => ({ useWorkspaceMemberDirectory: useWorkspaceMemberDirectoryMock }))
vi.mock('@/modules/intelligence/dismissals/useDismissedSuggestions', () => ({ useDismissedSuggestions: useDismissedSuggestionsMock }))

import { WorkspaceIntelligenceHubPage } from '@/modules/hub/pages/WorkspaceIntelligenceHubPage'

function renderPage() {
  return render(createElement(MemoryRouter, null, createElement(WorkspaceIntelligenceHubPage)))
}

afterEach(cleanup)

describe('WorkspaceIntelligenceHubPage', () => {
  const refetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceMock.mockReturnValue({ currentWorkspaceId: 'ws-1' })
    useGreetingMock.mockReturnValue({ headline: 'Good morning', subtext: 'Here is your workspace.' })
    useCommandContextMock.mockReturnValue({})
    useCommandActionsMock.mockReturnValue({})
    useWorkspaceMemberDirectoryMock.mockReturnValue({ members: [], isShared: false })
    useDismissedSuggestionsMock.mockReturnValue({ dismissedKeys: new Set(), dismiss: vi.fn() })
  })

  it('shows a spinner while loading, not the error or empty state', () => {
    useWorkspaceHubMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch, summary: null, workspaceName: 'My Workspace' })

    renderPage()

    expect(screen.queryByText("The Hub couldn't load")).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('shows an explicit error state with a Retry action when the query fails, instead of rendering nothing', () => {
    useWorkspaceHubMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch, summary: null, workspaceName: 'My Workspace' })

    renderPage()

    expect(screen.getByText("The Hub couldn't load")).not.toBeNull()
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    fireEvent.click(retryButton)
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('does not show the error state once data loads successfully (zero-data onboarding branch)', () => {
    useWorkspaceHubMock.mockReturnValue({
      data: { isZeroData: true },
      isLoading: false,
      isError: false,
      refetch,
      summary: null,
      workspaceName: 'My Workspace',
    })

    renderPage()

    expect(screen.queryByText("The Hub couldn't load")).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('prompts to select a workspace when there is no current workspace, unaffected by query error state', () => {
    useWorkspaceMock.mockReturnValue({ currentWorkspaceId: null })
    useWorkspaceHubMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch, summary: null, workspaceName: 'This workspace' })

    renderPage()

    expect(screen.getByText('Select a workspace')).not.toBeNull()
    expect(screen.queryByText("The Hub couldn't load")).toBeNull()
  })
})
