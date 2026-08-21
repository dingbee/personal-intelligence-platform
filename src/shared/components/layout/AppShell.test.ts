import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

/**
 * First-Login Welcome Experience gate — AppShell wraps every ordinary
 * protected route, so this is where a genuinely new account (profile.
 * onboarding_completed_at === null) gets sent to /welcome before ever
 * seeing the normal app chrome. Every other AppShell child is mocked to
 * a trivial stub so this test is isolated to the redirect decision itself
 * (Rules-of-Hooks safety around that conditional return is exactly what
 * regressed once already while building this — see the component's own
 * comment).
 */

const { useProfileMock } = vi.hoisted(() => ({ useProfileMock: vi.fn() }))

vi.mock('@/modules/settings/hooks/useProfile', () => ({ useProfile: useProfileMock }))
vi.mock('@/shared/components/layout/Sidebar', () => ({ Sidebar: () => null }))
vi.mock('@/shared/components/layout/TopBar', () => ({ TopBar: () => null }))
vi.mock('@/shared/components/layout/MobileNavDrawer', () => ({ MobileNavDrawer: () => null }))
vi.mock('@/modules/commands/components/NovaCommandBar', () => ({ NovaCommandBar: () => null }))
vi.mock('@/modules/capture/components/QuickCaptureDialog', () => ({ QuickCaptureDialog: () => null }))

import { AppShell } from '@/shared/components/layout/AppShell'

function renderShell() {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: ['/hub'] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/hub', element: createElement(AppShell) }),
        createElement(Route, { path: '/welcome', element: createElement('div', null, 'Welcome page') }),
      ),
    ),
  )
}

afterEach(cleanup)

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects a genuinely new account (onboarding_completed_at null) to /welcome', () => {
    useProfileMock.mockReturnValue({ data: { id: 'user-1', onboarding_completed_at: null }, isLoading: false })
    renderShell()
    expect(screen.getByText('Welcome page')).not.toBeNull()
  })

  it('renders the normal app shell for an established account', () => {
    useProfileMock.mockReturnValue({ data: { id: 'user-1', onboarding_completed_at: '2026-01-01T00:00:00Z' }, isLoading: false })
    renderShell()
    expect(screen.queryByText('Welcome page')).toBeNull()
  })

  it('does not redirect while the profile is still loading (avoids a premature flash)', () => {
    useProfileMock.mockReturnValue({ data: undefined, isLoading: true })
    renderShell()
    expect(screen.queryByText('Welcome page')).toBeNull()
  })
})
