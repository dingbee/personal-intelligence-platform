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
  adminSetPlanAiProvider,
  adminSetPlatformProviderSetting,
  adminSetUserDisabled,
  adminSetUserQuotaOverride,
  adminUpdatePlanCommercial,
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

/**
 * `plans`/`plan_quotas`/`plan_ai_providers` are all authenticated-read-all,
 * so this is a direct table read like any other client query — no RPC
 * needed for reading, only for the writes below. Shared by
 * AdminDashboardPage (Overview) and AdminPlansPage (the Plans &
 * Commercial control centre). Phase 5A extended this with pricing
 * metadata and the AI provider allocation matrix rather than adding a
 * second combined query, since every consumer of the plan catalog wants
 * the same joined shape.
 */
export function useAdminPlansAndQuotas() {
  return useQuery({
    queryKey: ['admin-plans-quotas'],
    queryFn: async () => {
      const [{ data: plans }, { data: quotas }, { data: aiProviders }] = await Promise.all([
        supabase
          .from('plans')
          .select('id, code, name, description, active, monthly_price_cents, annual_price_cents, currency')
          .order('created_at'),
        supabase.from('plan_quotas').select('id, plan_id, quota_key, quota_limit, quota_period'),
        supabase.from('plan_ai_providers').select('id, plan_id, provider_id, priority, active'),
      ])
      return { plans: plans ?? [], quotas: quotas ?? [], aiProviders: aiProviders ?? [] }
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

export function useAdminSetPlanAiProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminSetPlanAiProvider,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-plans-quotas'] })
      // The caller's own live provider chain reads plan_ai_providers too
      // (usePlanAllowedProviders) — invalidate it so an admin editing
      // their own plan's allocation sees the effect immediately.
      void queryClient.invalidateQueries({ queryKey: ['plan-ai-providers'] })
    },
  })
}

export function useAdminUpdatePlanCommercial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminUpdatePlanCommercial,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-plans-quotas'] })
    },
  })
}
