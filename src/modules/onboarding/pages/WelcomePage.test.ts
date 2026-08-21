import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

/**
 * First-Login Welcome Experience — every primary action must both mark
 * onboarding complete (so it never reappears) and navigate straight into
 * the real, existing flow it names — never a fake/demo destination. Skip
 * does the same completion write without picking a specific destination
 * flow.
 */

const { useAuthMock, useProfileMock, navigateMock, completeOnboardingMutate } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useProfileMock: vi.fn(),
  navigateMock: vi.fn(),
  completeOnboardingMutate: vi.fn(),
}))

vi.mock('@/modules/auth/useAuth', () => ({ useAuth: useAuthMock }))
vi.mock('@/modules/settings/hooks/useProfile', () => ({ useProfile: useProfileMock }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

import { WelcomePage } from '@/modules/onboarding/pages/WelcomePage'

afterEach(cleanup)

describe('WelcomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthMock.mockReturnValue({ user: { id: 'user-1', email: 'new@example.com' } })
    useProfileMock.mockReturnValue({ completeOnboarding: { mutate: completeOnboardingMutate } })
  })

  it('shows the core welcome message naming the product', () => {
    render(createElement(WelcomePage))
    expect(screen.getByText(/Welcome to ARRIYIA/)).not.toBeNull()
  })

  it('presents all four primary starting actions', () => {
    render(createElement(WelcomePage))
    expect(screen.getByRole('button', { name: 'Upload a document' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Start a conversation' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Go to workspaces' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Import from Drive' })).not.toBeNull()
  })

  it('"Upload a document" completes onboarding and navigates to the real Library flow', () => {
    render(createElement(WelcomePage))
    fireEvent.click(screen.getByRole('button', { name: 'Upload a document' }))
    expect(completeOnboardingMutate).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/library')
  })

  it('"Start a conversation" completes onboarding and navigates to the real chat flow', () => {
    render(createElement(WelcomePage))
    fireEvent.click(screen.getByRole('button', { name: 'Start a conversation' }))
    expect(completeOnboardingMutate).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/chat')
  })

  it('"Go to workspaces" completes onboarding and navigates to the real workspace flow', () => {
    render(createElement(WelcomePage))
    fireEvent.click(screen.getByRole('button', { name: 'Go to workspaces' }))
    expect(completeOnboardingMutate).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/settings/workspaces')
  })

  it('skipping completes onboarding and returns to the normal app', () => {
    render(createElement(WelcomePage))
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(completeOnboardingMutate).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('shows a lightweight, non-gating progress indicator', () => {
    render(createElement(WelcomePage))
    expect(screen.getByLabelText('Getting started progress')).not.toBeNull()
    expect(screen.getByText('Get started')).not.toBeNull()
    expect(screen.getByText('Add knowledge')).not.toBeNull()
    expect(screen.getByText('Start working')).not.toBeNull()
  })

  it('shows a short guided orientation covering the essential concepts', () => {
    render(createElement(WelcomePage))
    expect(screen.getByText('Your Library')).not.toBeNull()
    expect(screen.getByText('Conversations')).not.toBeNull()
    expect(screen.getByText('Intelligence')).not.toBeNull()
    expect(screen.getByText('Workspaces')).not.toBeNull()
  })
})
