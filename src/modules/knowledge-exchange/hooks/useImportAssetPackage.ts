import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { importAssetPackage } from '@/modules/knowledge-exchange/assets/importAssetPackage'
import type { AssetPackage } from '@/modules/knowledge-exchange/assets/assetPackageTypes'

export function useImportAssetPackage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { pkg: AssetPackage; workspaceId: string | null }) =>
      importAssetPackage(params.pkg, { userId: user!.id, workspaceId: params.workspaceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}
