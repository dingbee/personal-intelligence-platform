import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const { useHasProIntelligenceMock } = vi.hoisted(() => ({ useHasProIntelligenceMock: vi.fn() }))
vi.mock('@/modules/plans/hooks/useHasProIntelligence', () => ({ useHasProIntelligence: useHasProIntelligenceMock }))

import { RequireProIntelligence } from '@/modules/plans/RequireProIntelligence'

afterEach(cleanup)

function renderAt(path: string) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(Routes, null, [
        createElement(Route, {
          key: 'pro',
          path: '/pro-intelligence',
          element: createElement(RequireProIntelligence, null, createElement('div', null, 'Pro Intelligence workspace')),
        }),
        createElement(Route, { key: 'pricing', path: '/pricing', element: createElement('div', null, 'Pricing page') }),
      ]),
    ),
  )
}

/**
 * Phase P0 Pro Intelligence Foundation — mirrors RequireAdmin.test.ts's
 * exact structure (loading / entitled / not-entitled), since
 * RequireProIntelligence is the same guard shape with a different
 * entitlement source and redirect target. No production route wraps
 * this guard yet (P0 is architecture-only), so these synthetic routes
 * are the only place its access-boundary behavior is exercised —
 * exactly per the brief's "testable access boundaries" requirement.
 */
describe('RequireProIntelligence', () => {
  it('shows a spinner while the entitlement check is loading, rendering neither children nor the redirect target', () => {
    useHasProIntelligenceMock.mockReturnValue({ data: undefined, isLoading: true })

    renderAt('/pro-intelligence')

    expect(screen.queryByText('Pro Intelligence workspace')).toBeNull()
    expect(screen.queryByText('Pricing page')).toBeNull()
  })

  it('renders children for a Pro-entitled user', () => {
    useHasProIntelligenceMock.mockReturnValue({ data: true, isLoading: false })

    renderAt('/pro-intelligence')

    expect(screen.queryByText('Pro Intelligence workspace')).not.toBeNull()
  })

  it('renders children for a Founding Pro-entitled user identically — same entitlement check, no special-casing', () => {
    useHasProIntelligenceMock.mockReturnValue({ data: true, isLoading: false })

    renderAt('/pro-intelligence')

    expect(screen.queryByText('Pro Intelligence workspace')).not.toBeNull()
  })

  it('redirects a Free user to /pricing instead of rendering Pro Intelligence content', () => {
    useHasProIntelligenceMock.mockReturnValue({ data: false, isLoading: false })

    renderAt('/pro-intelligence')

    expect(screen.queryByText('Pro Intelligence workspace')).toBeNull()
    expect(screen.queryByText('Pricing page')).not.toBeNull()
  })

  it('redirects unauthorized direct navigation to the guarded path the same way a UI-driven visit would be', () => {
    useHasProIntelligenceMock.mockReturnValue({ data: false, isLoading: false })

    renderAt('/pro-intelligence')

    expect(screen.queryByText('Pro Intelligence workspace')).toBeNull()
  })
})
