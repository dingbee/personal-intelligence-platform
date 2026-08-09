import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { RouteErrorBoundary } from '@/shared/components/errors/RouteErrorBoundary'

afterEach(cleanup)

function ThrowingPage(): never {
  throw new Error('boom: internal detail that must never reach the user')
}

describe('RouteErrorBoundary', () => {
  it('renders the generic fallback (not the raw error) when a route throws during render', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const router = createMemoryRouter(
      [{ path: '/', element: createElement(ThrowingPage), errorElement: createElement(RouteErrorBoundary) }],
      { initialEntries: ['/'] },
    )
    render(createElement(RouterProvider, { router }))

    expect(screen.getByText('Something went wrong')).not.toBeNull()
    expect(screen.queryByText(/internal detail/)).toBeNull()

    consoleSpy.mockRestore()
  })

  it('renders a 404-specific message for an unmatched route', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const router = createMemoryRouter(
      [{ path: '/', element: createElement('div', null, 'home'), errorElement: createElement(RouteErrorBoundary) }],
      { initialEntries: ['/this-route-does-not-exist'] },
    )
    render(createElement(RouterProvider, { router }))

    expect(screen.getByText('Page not found')).not.toBeNull()

    consoleSpy.mockRestore()
  })
})
