import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import {
  adminAcknowledgeSystemHealthEvent,
  adminAiUsageSummary,
  adminApproveFoundingProApplication,
  adminChangeUserPlan,
  adminCommercialOverview,
  adminCreateBetaInvite,
  adminGetUserQuotaBreakdown,
  adminIgnoreSystemHealthEvent,
  adminInviteFoundingProMember,
  adminListBetaInvites,
  adminListFoundingProApplications,
  adminListFoundingProEvents,
  adminListFoundingProMembers,
  adminListSubscriptionEvents,
  adminListSubscriptions,
  adminListSystemHealthEvents,
  adminListUsers,
  adminPlanQuotaPopulation,
  adminPlatformCounts,
  adminRejectFoundingProApplication,
  adminRemoveUserQuotaOverride,
  adminReopenSystemHealthEvent,
  adminResetUserQuota,
  adminResolveSystemHealthEvent,
  adminRevokeBetaInvite,
  adminSetPlanAiProvider,
  adminSetPlatformProviderSetting,
  adminSetUserDisabled,
  adminSetUserQuotaOverride,
  adminSystemHealthSummary,
  adminUpdatePlanCommercial,
  adminUpdatePlanQuota,
  adminUsageOverview,
  sendBetaInvitationEmail,
  sendFoundingProInvitationEmail,
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

/**
 * Founding Pro Programme Phase 3 — admin operational surface reads/writes.
 * Approve/reject only invalidate the applications and audit-history lists:
 * neither RPC touches founding_pro_members or founding_pro_capacity (see
 * adminApproveFoundingProApplication/adminRejectFoundingProApplication),
 * so there is nothing in those queries to refresh.
 */
export function useAdminFoundingProApplications() {
  return useQuery({ queryKey: ['admin-founding-pro-applications'], queryFn: adminListFoundingProApplications })
}

export function useAdminFoundingProMembers() {
  return useQuery({ queryKey: ['admin-founding-pro-members'], queryFn: adminListFoundingProMembers })
}

export function useAdminFoundingProEvents() {
  return useQuery({ queryKey: ['admin-founding-pro-events'], queryFn: adminListFoundingProEvents })
}

export function useAdminApproveFoundingProApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminApproveFoundingProApplication,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-founding-pro-applications'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-founding-pro-events'] })
    },
  })
}

export function useAdminRejectFoundingProApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminRejectFoundingProApplication,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-founding-pro-applications'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-founding-pro-events'] })
    },
  })
}

/**
 * Founding Pro Programme Phase 4 — sending an invitation only ever
 * writes founding_pro_invitations + an audit event, never
 * founding_pro_members/_capacity, so only those two lists are
 * invalidated (same "invalidate exactly what changed" discipline as
 * approve/reject above).
 */
export function useAdminInviteFoundingProMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminInviteFoundingProMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-founding-pro-applications'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-founding-pro-events'] })
    },
  })
}

/** Founding Pro Programme Phase 4 — deliberately not wired to invalidate any query: sending the email never changes invitation state, only its delivery. Mirrors useAdminSendBetaInvitationEmail's own reasoning exactly. */
export function useAdminSendFoundingProInvitationEmail() {
  return useMutation({ mutationFn: sendFoundingProInvitationEmail })
}

/**
 * #21 Phase 4.3 — Admin Billing & Subscription Operations. Read-only:
 * there is no admin mutation hook for billing state, by design (see
 * adminApi.ts's own header comment on this section).
 */
export function useAdminSubscriptions(filters?: { status?: string | null; planCode?: string | null }) {
  return useQuery({
    queryKey: ['admin-subscriptions', filters?.status ?? null, filters?.planCode ?? null],
    queryFn: () => adminListSubscriptions({ status: filters?.status, planCode: filters?.planCode }),
  })
}

export function useAdminSubscriptionEvents(filters?: { processingStatus?: string | null }) {
  return useQuery({
    queryKey: ['admin-subscription-events', filters?.processingStatus ?? null],
    queryFn: () => adminListSubscriptionEvents({ processingStatus: filters?.processingStatus }),
  })
}

export function useAdminCommercialOverview() {
  return useQuery({ queryKey: ['admin-commercial-overview'], queryFn: adminCommercialOverview })
}

/** #21 Phase 4.4 — Admin Usage & Quota Operations reads. Overrides still write through useAdminSetUserQuotaOverride/useAdminRemoveUserQuotaOverride above; this only adds the missing per-user, per-plan read views. */
export function useAdminUserQuotaBreakdown(userId: string | null) {
  return useQuery({
    queryKey: ['admin-user-quota-breakdown', userId],
    queryFn: () => adminGetUserQuotaBreakdown(userId as string),
    enabled: userId != null,
  })
}

export function useAdminPlanQuotaPopulation() {
  return useQuery({ queryKey: ['admin-plan-quota-population'], queryFn: adminPlanQuotaPopulation })
}

export function useAdminUsageOverview() {
  return useQuery({ queryKey: ['admin-usage-overview'], queryFn: adminUsageOverview })
}

/**
 * #21 Phase 5 — Unified Admin Intelligence / Error Centre. Every mutation
 * here invalidates both the filtered list and the summary tiles, since an
 * acknowledge/resolve/reopen/ignore always changes at least one status
 * count. The list query key includes every filter value so switching
 * filters in the UI doesn't reuse a stale cached page.
 */
export function useAdminSystemHealthEvents(filters?: {
  category?: string | null
  severity?: string | null
  status?: string | null
  since?: string | null
  userId?: string | null
  operation?: string | null
  provider?: string | null
}) {
  return useQuery({
    queryKey: [
      'admin-system-health-events',
      filters?.category ?? null,
      filters?.severity ?? null,
      filters?.status ?? null,
      filters?.since ?? null,
      filters?.userId ?? null,
      filters?.operation ?? null,
      filters?.provider ?? null,
    ],
    queryFn: () => adminListSystemHealthEvents(filters),
  })
}

export function useAdminSystemHealthSummary() {
  return useQuery({ queryKey: ['admin-system-health-summary'], queryFn: adminSystemHealthSummary })
}

function useAdminSystemHealthEventMutation(mutationFn: (eventId: string) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-system-health-events'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-system-health-summary'] })
    },
  })
}

export function useAdminAcknowledgeSystemHealthEvent() {
  return useAdminSystemHealthEventMutation(adminAcknowledgeSystemHealthEvent)
}

export function useAdminResolveSystemHealthEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminResolveSystemHealthEvent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-system-health-events'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-system-health-summary'] })
    },
  })
}

export function useAdminReopenSystemHealthEvent() {
  return useAdminSystemHealthEventMutation(adminReopenSystemHealthEvent)
}

export function useAdminIgnoreSystemHealthEvent() {
  return useAdminSystemHealthEventMutation(adminIgnoreSystemHealthEvent)
}
