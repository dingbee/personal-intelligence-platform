import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminCreateBetaInvite, adminListBetaInvites, adminListUsers, adminRevokeBetaInvite } from '@/modules/admin/api/adminApi'

export function useAdminUsers() {
  return useQuery({ queryKey: ['admin-users'], queryFn: adminListUsers })
}

export function useAdminBetaInvites() {
  return useQuery({ queryKey: ['admin-beta-invites'], queryFn: adminListBetaInvites })
}

export function useAdminCreateBetaInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminCreateBetaInvite,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-beta-invites'] })
    },
  })
}

export function useAdminRevokeBetaInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminRevokeBetaInvite,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-beta-invites'] })
    },
  })
}
