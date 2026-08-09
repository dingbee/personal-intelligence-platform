import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import {
  adminAiUsageSummary,
  adminChangeUserPlan,
  adminCreateBetaInvite,
  adminListBetaInvites,
  adminListUsers,
  adminPlatformCounts,
  adminRemoveUserQuotaOverride,
  adminResetUserQuota,
  adminRevokeBetaInvite,
  adminSetPlatformProviderSetting,
  adminSetUserDisabled,
  adminSetUserQuotaOverride,
  adminUpdatePlanQuota,
  sendBetaInvitationEmail,
} from '@/modules/admin/api/adminApi'
import { listPlatformProviderSettings } from '@/modules/ai/providers/api/platformProviderSettings'

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

/** PIP Stabilization v1 (P1) — deliberately not wired to invalidate ['admin-beta-invites']: sending the email never changes the invite row's status, so there's nothing in that list to refresh. Kept as its own mutation (rather than folded into useAdminCreateBetaInvite) so the UI can report "invite created" and "email sent/failed" as the two distinct outcomes the task requires. */
export function useAdminSendBetaInvitationEmail() {
  return useMutation({ mutationFn: sendBetaInvitationEmail })
}

export function useAdminChangeUserPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminChangeUserPlan,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

export function useAdminResetUserQuota() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminResetUserQuota,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

export function useAdminSetUserQuotaOverride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminSetUserQuotaOverride,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

export function useAdminRemoveUserQuotaOverride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminRemoveUserQuotaOverride,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

export function useAdminSetUserDisabled() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminSetUserDisabled,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })
}

export function useAdminPlatformProviderSettings() {
  return useQuery({ queryKey: ['admin-platform-provider-settings'], queryFn: listPlatformProviderSettings })
}

export function useAdminSetPlatformProviderSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminSetPlatformProviderSetting,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-platform-provider-settings'] })
      void queryClient.invalidateQueries({ queryKey: ['platform-provider-settings'] })
    },
  })
}

export function useAdminAiUsageSummary() {
  return useQuery({ queryKey: ['admin-ai-usage-summary'], queryFn: () => adminAiUsageSummary() })
}

export function useAdminPlatformCounts() {
  return useQuery({ queryKey: ['admin-platform-counts'], queryFn: adminPlatformCounts })
}

/** `plans`/`plan_quotas` are authenticated-read-all (0034), so this is a direct table read like any other client query — no RPC needed for reading, only for the write below. Shared by AdminDashboardPage (Overview) and AdminPlansPage (management). */
export function useAdminPlansAndQuotas() {
  return useQuery({
    queryKey: ['admin-plans-quotas'],
    queryFn: async () => {
      const [{ data: plans }, { data: quotas }] = await Promise.all([
        supabase.from('plans').select('id, code, name, description, active').order('created_at'),
        supabase.from('plan_quotas').select('id, plan_id, quota_key, quota_limit, quota_period'),
      ])
      return { plans: plans ?? [], quotas: quotas ?? [] }
    },
  })
}

export function useAdminUpdatePlanQuota() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminUpdatePlanQuota,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-plans-quotas'] })
    },
  })
}
