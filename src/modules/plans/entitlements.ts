/**
 * Beta / Admin / AI Governance Foundation — the server-side plan/admin
 * data (user_plan_assignments -> plans.code, platform_admins) is the
 * actual enforcement; these are pure presentation-layer decisions built
 * on top of that already-authoritative resolution — never the other way
 * around. Nothing here can be spoofed into granting real access: a user
 * flipping `canSelectProvider` to true client-side would just make the
 * Advanced Settings picker render, calling the exact same
 * `default_chat_provider_id` update any user can already make — no new
 * privilege is actually gated by this function.
 */
export function canSelectProvider(planCode: string | null | undefined): boolean {
  return planCode === 'pro' || planCode === 'enterprise'
}
