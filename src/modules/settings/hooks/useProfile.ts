import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getProfile, updateProfile } from '@/modules/settings/api/profile'
import { useAuth } from '@/modules/auth/useAuth'

export function useProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const profileKey = ['profile', user?.id]

  const query = useQuery({
    queryKey: profileKey,
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user),
  })

  const updateDisplayName = useMutation({
    mutationFn: (displayName: string) => updateProfile(user!.id, displayName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey }),
  })

  return { ...query, updateDisplayName }
}
