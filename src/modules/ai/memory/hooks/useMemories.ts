import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMemory,
  deleteMemory,
  listMemories,
  setMemoryCategoryActive,
  updateMemory,
  type MemoryFilters,
} from '@/modules/ai/memory/api/memory'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import type { AiMemoryType } from '@/shared/types/database'
import type { MemoryCandidate } from '@/modules/ai/memory/memoryDetection/types'

/** No consumer wires this into chat/RAG yet (Phase UX-5 is the memory foundation only) — this is the CRUD layer a future write/read integration will call into. */
export function useMemories(filters: Omit<MemoryFilters, 'workspaceId'> = {}) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const scopedFilters: MemoryFilters = { ...filters, workspaceId: currentWorkspaceId }
  const queryKey = ['ai-memory', scopedFilters]

  const query = useQuery({
    queryKey,
    queryFn: () => listMemories(scopedFilters),
    enabled: Boolean(user),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ai-memory'] })

  const create = useMutation({
    mutationFn: (params: { memoryType: AiMemoryType; content: string; source?: string | null; confidence?: number | null }) =>
      createMemory({ ...params, userId: user!.id, workspaceId: currentWorkspaceId }),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: (params: { id: string; content: string; confidence?: number | null }) =>
      updateMemory(params.id, { content: params.content, ...(params.confidence !== undefined && { confidence: params.confidence }) }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteMemory(id),
    onSuccess: invalidate,
  })

  /** UX-13.6 Phase 2 — the "Remember preferences" / "Remember conversation style" bulk toggles: enables or disables every memory of one type at once, reusing the same setMemoryCategoryActive the UX-5.3A brief already specified but no UI called until now. */
  const setCategoryActive = useMutation({
    mutationFn: (params: { memoryType: AiMemoryType; isActive: boolean }) =>
      setMemoryCategoryActive({ ...params, workspaceId: currentWorkspaceId }),
    onSuccess: invalidate,
  })

  /**
   * UX-14.3.5 — the one "turn an approved MemoryCandidate into a real row"
   * mapping, shared by every surface that renders MemoryApprovalPanel
   * (MemoryManagementPage, ChatPage, ReaderChatPanel) instead of each
   * re-deriving the same createMemory params. Carries candidate.confidence
   * through — the exact discard point UX-14.3 fixed — so every caller gets
   * that for free rather than needing to remember to pass it themselves.
   */
  function rememberCandidate(candidate: MemoryCandidate) {
    create.mutate({ memoryType: candidate.type, content: candidate.content, source: 'conversation', confidence: candidate.confidence })
  }

  return { ...query, create, update, remove, setCategoryActive, rememberCandidate }
}
