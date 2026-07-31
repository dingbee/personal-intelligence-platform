import { useQuery } from '@tanstack/react-query'
import { getAssetSignedUrl } from '@/modules/assets/api/assets'
import { useAuth } from '@/modules/auth/useAuth'

/** Refetch a bit before the signed URL itself expires (60 min, see assets.ts) so an image never silently 403s mid-session. */
const STALE_TIME_MS = 50 * 60 * 1000

/** UX-13.9 — one signed URL per storage path, cached and refreshed before expiry; every image-displaying component (ImageCard's thumbnail, the lightbox, the reader) reads through this instead of calling getAssetSignedUrl itself. */
export function useSignedAssetUrl(path: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['asset-signed-url', path],
    queryFn: () => getAssetSignedUrl(path!),
    enabled: Boolean(user) && Boolean(path),
    staleTime: STALE_TIME_MS,
  })
}
