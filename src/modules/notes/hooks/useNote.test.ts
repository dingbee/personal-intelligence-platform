import { describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'

// UX-14.5 Phase 2 — regression test for the bug found while designing
// note sharing (docs/ux-14.5.5-note-sharing-design.md §1.3): useNote's
// save/summarize mutations used to attribute linkKnownConceptsToSource
// to the note's *original owner* (note.user_id) instead of whoever is
// actually saving. Harmless while only a note's own owner could ever
// open it; the moment an editor other than the owner saves a shared
// note, that mismatch makes the resulting knowledge_node_sources insert
// fail RLS (auth.uid() != user_id) — silently, since the call swallows
// its own errors. This test renders the real hook and asserts the fix:
// the acting user's id is what gets passed, not the note's.
const { updateNoteMock, linkKnownConceptsToSourceMock, indexNoteMock, getNoteMock } = vi.hoisted(() => ({
  updateNoteMock: vi.fn(),
  linkKnownConceptsToSourceMock: vi.fn(),
  indexNoteMock: vi.fn(),
  getNoteMock: vi.fn(),
}))

vi.mock('@/modules/notes/api/notes', () => ({
  getNote: getNoteMock,
  updateNote: updateNoteMock,
}))
vi.mock('@/modules/knowledge-intelligence/api/linkKnownConcepts', () => ({
  linkKnownConceptsToSource: linkKnownConceptsToSourceMock,
}))
vi.mock('@/modules/search/indexing/indexNote', () => ({
  indexNote: indexNoteMock,
}))
vi.mock('@/modules/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'editor-user-id' } }),
}))
vi.mock('@/modules/workspaces/useWorkspace', () => ({
  useWorkspace: () => ({ currentWorkspaceId: 'workspace-1' }),
}))
vi.mock('@/modules/ai/providers/useDefaultChatProviderId', () => ({
  useDefaultChatProviderId: () => 'provider-1',
}))
vi.mock('@/modules/ai/router/useProviderChain', () => ({
  useProviderChain: () => ['provider-1'],
}))

import { useNote } from '@/modules/notes/hooks/useNote'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return createElement(QueryClientProvider, { client: queryClient }, children)
}

describe('useNote save', () => {
  it('attributes linkKnownConceptsToSource to the acting user, not the note owner', async () => {
    getNoteMock.mockResolvedValue({
      id: 'note-1',
      user_id: 'owner-user-id',
      workspace_id: 'workspace-1',
      title: 'Shared note',
      content: 'original content',
    })
    updateNoteMock.mockResolvedValue({
      id: 'note-1',
      // The note's own owner — deliberately different from the acting
      // editor (see useAuth mock above) to prove the fix reads the
      // acting user's id, not this field.
      user_id: 'owner-user-id',
      title: 'Shared note',
      content: 'edited by a non-owner editor',
    })

    const { result } = renderHook(() => useNote('note-1'), { wrapper })

    result.current.save.mutate({ title: 'Shared note', content: 'edited by a non-owner editor' })

    await waitFor(() => expect(linkKnownConceptsToSourceMock).toHaveBeenCalled())

    expect(linkKnownConceptsToSourceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'editor-user-id',
        sourceType: 'note',
        sourceId: 'note-1',
      }),
    )
  })
})
