import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCollection,
  deleteCollection,
  listCollections,
  renameCollection,
} from '@/modules/library/api/collections'
import { useAuth } from '@/modules/auth/useAuth'

const collectionsKey = ['collections']

export function useCollections() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({ queryKey: collectionsKey, queryFn: listCollections, enabled: Boolean(user) })

  const create = useMutation({
    mutationFn: (params: { name: string; parentId: string | null }) =>
      createCollection({ ...params, userId: user!.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionsKey }),
  })

  const rename = useMutation({
    mutationFn: (params: { id: string; name: string }) => renameCollection(params.id, params.name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: collectionsKey }),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionsKey })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  return { ...query, create, rename, remove }
}
