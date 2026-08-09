import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { AppErrorBoundary } from '@/shared/components/errors/AppErrorBoundary'

afterEach(cleanup)

function ThrowingChild(): never {
  throw new Error('boom: internal detail that must never reach the user')
}

describe('AppErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(createElement(AppErrorBoundary, null, createElement('div', null, 'Workspace content')))

    expect(screen.getByText('Workspace content')).not.toBeNull()
  })

  it('renders the generic fallback instead of crashing to blank when a child throws', () => {
    // React logs the caught error to the console by design; silence it so
    // the expected-failure test doesn't look like a real test failure.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(createElement(AppErrorBoundary, null, createElement(ThrowingChild)))

    expect(screen.getByText('Something went wrong')).not.toBeNull()
    expect(screen.queryByText(/internal detail/)).toBeNull()

    consoleSpy.mockRestore()
  })
})
