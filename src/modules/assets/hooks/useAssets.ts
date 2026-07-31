import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteAsset, listAssets, uploadAsset } from '@/modules/assets/api/assets'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

/** UX-13.8.2 — CRUD layer over the assets pipeline; no UI consumes this yet (see the phase's own scope note — asset display/attachment surfaces are deferred), same "foundation before the feature that uses it" shape ai/memory/hooks/useMemories.ts documented for itself. */
export function useAssets() {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const queryKey = ['assets', currentWorkspaceId]

  const query = useQuery({
    queryKey,
    queryFn: () => listAssets({ workspaceId: currentWorkspaceId }),
    enabled: Boolean(user),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assets'] })

  const upload = useMutation({
    mutationFn: (file: File) => uploadAsset({ file, userId: user!.id, workspaceId: currentWorkspaceId }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: deleteAsset,
    onSuccess: invalidate,
  })

  return { assets: query.data ?? [], isLoading: query.isLoading, isError: query.isError, upload, remove }
}
