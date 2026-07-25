import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCollection,
  deleteCollection,
  listCollections,
  renameCollection,
} from '@/modules/library/api/collections'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

export function useCollections() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const collectionsKey = ['collections', currentWorkspaceId]

  const query = useQuery({
    queryKey: collectionsKey,
    queryFn: () => listCollections(currentWorkspaceId),
    enabled: Boolean(user),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['collections'] })

  const create = useMutation({
    mutationFn: (params: { name: string; parentId: string | null }) =>
      createCollection({ ...params, userId: user!.id, workspaceId: currentWorkspaceId }),
    onSuccess: invalidate,
  })

  const rename = useMutation({
    mutationFn: (params: { id: string; name: string }) => renameCollection(params.id, params.name),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  return { ...query, create, rename, remove }
}
