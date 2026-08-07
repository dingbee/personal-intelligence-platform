import { supabase } from '@/shared/lib/supabase'

/** Every function here calls a SECURITY DEFINER RPC that re-checks is_platform_admin() itself and raises if the caller isn't one — the authorization is enforced by the database, this file is a thin, unprivileged wrapper. */

export async function adminListUsers() {
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw error
  return data ?? []
}

export async function adminListBetaInvites() {
  const { data, error } = await supabase.rpc('admin_list_beta_invites')
  if (error) throw error
  return data ?? []
}

export async function adminCreateBetaInvite(params: {
  email: string
  fullName?: string | null
  organization?: string | null
  planId?: string | null
}) {
  const { data, error } = await supabase.rpc('admin_create_beta_invite', {
    p_email: params.email,
    p_full_name: params.fullName ?? null,
    p_organization: params.organization ?? null,
    p_plan_id: params.planId ?? null,
  })
  if (error) throw error
  return data?.[0] ?? { outcome: 'duplicate' as const, invite_id: null }
}

export async function adminRevokeBetaInvite(inviteId: string) {
  const { data, error } = await supabase.rpc('admin_revoke_beta_invite', { p_invite_id: inviteId })
  if (error) throw error
  return data ?? false
}
