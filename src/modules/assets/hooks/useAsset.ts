import { useQuery } from '@tanstack/react-query'
import { getAsset } from '@/modules/assets/api/assets'

export function useAsset(assetId: string) {
  return useQuery({
    queryKey: ['asset-detail', assetId],
    queryFn: () => getAsset(assetId),
  })
}
