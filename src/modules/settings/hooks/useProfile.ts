import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { getProfile, updateProfile } from '@/modules/settings/api/profile'
import type { Profile } from '@/shared/types/database'

export function useProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['profile', user?.id]

  const query = useQuery({
    queryKey,
    queryFn: () => getProfile(user!.id),
    enabled: Boolean(user),
  })

  const save = useMutation({
    mutationFn: (updates: Partial<Profile>) => updateProfile(user!.id, updates),
    onSuccess: (profile) => queryClient.setQueryData(queryKey, profile),
  })

  return { profile: query.data, isLoading: query.isLoading, save }
}
