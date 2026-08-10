import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'

const { uploadDocumentMock, renameDocumentMock, moveDocumentMock, deleteDocumentMock, processDocumentMock } = vi.hoisted(() => ({
  uploadDocumentMock: vi.fn(),
  renameDocumentMock: vi.fn(),
  moveDocumentMock: vi.fn(),
  deleteDocumentMock: vi.fn(),
  processDocumentMock: vi.fn(),
}))

vi.mock('@/modules/library/api/documents', () => ({
  uploadDocument: uploadDocumentMock,
  renameDocument: renameDocumentMock,
  moveDocument: moveDocumentMock,
  deleteDocument: deleteDocumentMock,
}))
vi.mock('@/modules/processing/pipeline/processDocument', () => ({ processDocument: processDocumentMock }))
vi.mock('@/modules/auth/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('@/modules/workspaces/useWorkspace', () => ({ useWorkspace: () => ({ currentWorkspaceId: 'ws-1' }) }))

import { useDocumentMutations } from '@/modules/library/hooks/useDocumentMutations'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

/**
 * Phase 3 — Quality Hardening. `upload` is the highest-risk mutation here:
 * it scopes the write to the current user/workspace and fires off
 * background processing as a deliberate fire-and-forget (the pipeline
 * reports its own progress via processing_jobs), so an upload's success
 * must never be gated on processing completing.
 */
describe('useDocumentMutations', () => {
  beforeEach(() => {
    uploadDocumentMock.mockReset()
    renameDocumentMock.mockReset()
    moveDocumentMock.mockReset()
    deleteDocumentMock.mockReset()
    processDocumentMock.mockReset()
  })

  it('uploads scoped to the current user and workspace, then kicks off processing without awaiting it', async () => {
    uploadDocumentMock.mockResolvedValueOnce({ id: 'doc-1' })
    processDocumentMock.mockImplementation(() => new Promise(() => {})) // never resolves

    const { result } = renderHook(() => useDocumentMutations(), { wrapper })
    const file = new File(['x'], 'a.pdf')
    result.current.upload.mutate({ file, collectionId: null })

    await waitFor(() => expect(result.current.upload.isSuccess).toBe(true))

    expect(uploadDocumentMock).toHaveBeenCalledWith({ file, collectionId: null, userId: 'user-1', workspaceId: 'ws-1' })
    expect(processDocumentMock).toHaveBeenCalledWith('doc-1', 'user-1')
  })

  it('never starts processing when the upload itself fails', async () => {
    uploadDocumentMock.mockRejectedValueOnce(new Error('upload failed'))

    const { result } = renderHook(() => useDocumentMutations(), { wrapper })
    result.current.upload.mutate({ file: new File(['x'], 'a.pdf'), collectionId: null })

    await waitFor(() => expect(result.current.upload.isError).toBe(true))
    expect(processDocumentMock).not.toHaveBeenCalled()
  })

  it('rename forwards id and title to the API', async () => {
    renameDocumentMock.mockResolvedValueOnce({ id: 'doc-1', title: 'New title' })
    const { result } = renderHook(() => useDocumentMutations(), { wrapper })
    result.current.rename.mutate({ id: 'doc-1', title: 'New title' })
    await waitFor(() => expect(result.current.rename.isSuccess).toBe(true))
    expect(renameDocumentMock).toHaveBeenCalledWith('doc-1', 'New title')
  })

  it('move forwards the target collection, including moving to uncategorized (null)', async () => {
    moveDocumentMock.mockResolvedValueOnce({ id: 'doc-1', collection_id: null })
    const { result } = renderHook(() => useDocumentMutations(), { wrapper })
    result.current.move.mutate({ id: 'doc-1', collectionId: null })
    await waitFor(() => expect(result.current.move.isSuccess).toBe(true))
    expect(moveDocumentMock).toHaveBeenCalledWith('doc-1', null)
  })

  it('remove forwards id and storage path to the API', async () => {
    deleteDocumentMock.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useDocumentMutations(), { wrapper })
    result.current.remove.mutate({ id: 'doc-1', filePath: 'user-1/abc.pdf' })
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true))
    expect(deleteDocumentMock).toHaveBeenCalledWith('doc-1', 'user-1/abc.pdf')
  })
})
