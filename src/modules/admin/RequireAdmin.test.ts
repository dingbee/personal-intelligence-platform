import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const { usePlatformAdminMock } = vi.hoisted(() => ({ usePlatformAdminMock: vi.fn() }))
vi.mock('@/modules/admin/hooks/usePlatformAdmin', () => ({ usePlatformAdmin: usePlatformAdminMock }))

import { RequireAdmin } from '@/modules/admin/RequireAdmin'

afterEach(cleanup)

function renderAt(path: string) {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(Routes, null, [
        createElement(Route, {
          key: 'admin',
          path: '/admin',
          element: createElement(RequireAdmin, null, createElement('div', null, 'Admin dashboard')),
        }),
        createElement(Route, { key: 'home', path: '/', element: createElement('div', null, 'Workspace home') }),
      ]),
    ),
  )
}

describe('RequireAdmin', () => {
  it('shows a spinner while the admin check is loading, rendering neither children nor the redirect target', () => {
    usePlatformAdminMock.mockReturnValue({ data: undefined, isLoading: true })

    renderAt('/admin')

    expect(screen.queryByText('Admin dashboard')).toBeNull()
    expect(screen.queryByText('Workspace home')).toBeNull()
  })

  it('renders children for a platform admin', () => {
    usePlatformAdminMock.mockReturnValue({ data: true, isLoading: false })

    renderAt('/admin')

    expect(screen.queryByText('Admin dashboard')).not.toBeNull()
  })

  it('redirects a non-admin to the workspace home instead of rendering the admin content', () => {
    usePlatformAdminMock.mockReturnValue({ data: false, isLoading: false })

    renderAt('/admin')

    expect(screen.queryByText('Admin dashboard')).toBeNull()
    expect(screen.queryByText('Workspace home')).not.toBeNull()
  })
})
