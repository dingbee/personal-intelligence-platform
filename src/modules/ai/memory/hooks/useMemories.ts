import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createMemory, deleteMemory, listMemories, updateMemory, type MemoryFilters } from '@/modules/ai/memory/api/memory'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'
import type { AiMemoryType } from '@/shared/types/database'

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
    mutationFn: (params: { memoryType: AiMemoryType; content: string; source?: string | null }) =>
      createMemory({ ...params, userId: user!.id, workspaceId: currentWorkspaceId }),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: (params: { id: string; content: string }) => updateMemory(params.id, { content: params.content }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteMemory(id),
    onSuccess: invalidate,
  })

  return { ...query, create, update, remove }
}
