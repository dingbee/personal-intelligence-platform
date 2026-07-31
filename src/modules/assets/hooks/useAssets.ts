import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteAsset, listAssets, renameAsset, uploadAsset } from '@/modules/assets/api/assets'
import { useAuth } from '@/modules/auth/useAuth'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

/** UX-13.8.2/13.9 — CRUD layer over the assets pipeline, workspace-scoped the same way useDocuments/useNotes already are — this scoping is what makes the Library's Images tab a "workspace asset management" surface without needing a separate page. */
export function useAssets(params: { search?: string } = {}) {
  const { user } = useAuth()
  const { currentWorkspaceId } = useWorkspace()
  const queryClient = useQueryClient()
  const queryKey = ['assets', currentWorkspaceId, params.search]

  const query = useQuery({
    queryKey,
    queryFn: () => listAssets({ workspaceId: currentWorkspaceId, search: params.search }),
    enabled: Boolean(user),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['assets'] })

  const upload = useMutation({
    mutationFn: (params: { file: File; title?: string }) =>
      uploadAsset({ file: params.file, title: params.title, userId: user!.id, workspaceId: currentWorkspaceId }),
    onSuccess: invalidate,
  })

  const rename = useMutation({
    mutationFn: (params: { id: string; title: string }) => renameAsset(params.id, params.title),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: deleteAsset,
    onSuccess: invalidate,
  })

  return { assets: query.data ?? [], isLoading: query.isLoading, isError: query.isError, upload, rename, remove }
}
