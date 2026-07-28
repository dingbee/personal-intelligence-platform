import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addTagToDocument, deleteTag, listTags, removeTagFromDocument, renameTag } from '@/modules/library/api/tags'
import { useAuth } from '@/modules/auth/useAuth'

const tagsKey = ['tags']

export function useTags() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({ queryKey: tagsKey, queryFn: listTags, enabled: Boolean(user) })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: tagsKey })
    queryClient.invalidateQueries({ queryKey: ['documents'] })
  }

  const addTag = useMutation({
    mutationFn: (params: { documentId: string; tagName: string }) =>
      addTagToDocument({ ...params, userId: user!.id }),
    onSuccess: invalidate,
  })

  const removeTag = useMutation({
    mutationFn: (params: { documentId: string; tagId: string }) =>
      removeTagFromDocument(params.documentId, params.tagId),
    onSuccess: invalidate,
  })

  const rename = useMutation({
    mutationFn: (params: { id: string; name: string }) => renameTag(params.id, params.name),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: invalidate,
  })

  return { ...query, addTag, removeTag, rename, remove }
}
