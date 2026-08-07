import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteAsset, listAssets, renameAsset, uploadAsset } from '@/modules/assets/api/assets'
import { useAnalyzeImage } from '@/modules/assets/hooks/useAnalyzeImage'
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
  const analyzeImage = useAnalyzeImage()

  const upload = useMutation({
    mutationFn: (params: { file: File; title?: string }) =>
      uploadAsset({ file: params.file, title: params.title, userId: user!.id, workspaceId: currentWorkspaceId }),
    onSuccess: (asset) => {
      invalidate()
      // PIP Stabilization v1 (P0, root cause D) — vision analysis used to
      // require the user to separately open the image and click "Analyze
      // with NOVA"; a freshly uploaded image had no description, no
      // extracted text, and no knowledge nodes until then. Fire-and-forget,
      // same "never block the UI, swallow own errors" contract indexAsset/
      // indexNote/autoReconcileNewKnowledge already follow — useAnalyzeImage
      // itself already invalidates the knowledge-graph queries this produces.
      analyzeImage.mutate(asset, {
        onError: (err) => console.error(`Automatic analysis failed for asset ${asset.id}:`, err),
      })
    },
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
