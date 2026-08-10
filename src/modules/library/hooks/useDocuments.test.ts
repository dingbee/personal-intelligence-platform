import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'

const { listDocumentsMock } = vi.hoisted(() => ({ listDocumentsMock: vi.fn() }))
vi.mock('@/modules/library/api/documents', () => ({ listDocuments: listDocumentsMock }))
vi.mock('@/modules/auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('@/modules/workspaces/useWorkspace', () => ({ useWorkspace: () => ({ currentWorkspaceId: 'ws-current' }) }))

import { useDocuments } from '@/modules/library/hooks/useDocuments'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

/**
 * Phase 3 — Quality Hardening. This hook is the sole place that injects
 * workspace scoping into every document list query in the app; a caller
 * can never opt out of it (the filter type doesn't even accept
 * `workspaceId`). Locking this down protects workspace isolation from
 * regressing silently in a future refactor.
 */
describe('useDocuments', () => {
  beforeEach(() => listDocumentsMock.mockReset())

  it('always scopes the query to the current workspace, on top of whatever filters the caller passed', async () => {
    listDocumentsMock.mockResolvedValueOnce([])
    const { result } = renderHook(() => useDocuments({ collectionId: 'col-1', search: 'invoice' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(listDocumentsMock).toHaveBeenCalledWith({
      collectionId: 'col-1',
      search: 'invoice',
      workspaceId: 'ws-current',
    })
  })
})
