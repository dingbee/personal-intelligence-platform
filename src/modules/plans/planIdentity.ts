/**
 * Phase 2.1 — Persistent Plan Identity. Pure resolver from a plan code
 * (+ optional founding-member number) to what the shell's plan indicator
 * shows. No new plan/database concept: every code recognized here is one
 * of the plans that already exists in `public.plans`
 * (free/pro/founding_pro/enterprise) — see this file's own comment on
 * `business` below for the one label mapping this introduces.
 */

export type PlanIdentityKind = 'free' | 'pro' | 'founding_pro' | 'business'

export interface PlanIdentityDisplay {
  kind: PlanIdentityKind
  label: string
  /** Secondary line under the label — an upgrade cue for Free, or a founding member number where available. Null when there's nothing to show. */
  secondaryText: string | null
  /** Where clicking the indicator navigates — always the existing /pricing surface; there is no separate billing page per plan. */
  href: string
}

/**
 * The codebase's existing top commercial tier is `plans.code = 'enterprise'`
 * (see BillingCard.tsx/PricingPage.tsx's own `['pro', 'founding_pro',
 * 'enterprise']` checks) — there is no plan literally coded or named
 * "business" anywhere in the schema today. Rather than inventing a new
 * plan row/code (explicitly out of scope for this phase), this resolver
 * displays the existing `enterprise` plan under the "Business" label the
 * spec asks for. `'business'` itself is also recognized so this keeps
 * working unchanged if a plan literally coded `business` is ever added
 * later.
 */
const BUSINESS_PLAN_CODES = new Set(['business', 'enterprise'])

export function resolvePlanIdentity(input: { planCode: string | null | undefined; foundingMemberNumber: number | null }): PlanIdentityDisplay {
  const { planCode, foundingMemberNumber } = input

  if (planCode === 'founding_pro') {
    return {
      kind: 'founding_pro',
      label: 'Founding Pro',
      secondaryText: foundingMemberNumber !== null ? `Founding Member #${foundingMemberNumber}` : null,
      href: '/pricing',
    }
  }

  if (planCode === 'pro') {
    return { kind: 'pro', label: 'Pro', secondaryText: null, href: '/pricing' }
  }

  if (planCode && BUSINESS_PLAN_CODES.has(planCode)) {
    return { kind: 'business', label: 'Business', secondaryText: null, href: '/pricing' }
  }

  // Everything else (no plan assignment, 'free', 'beta', or any other
  // unrecognized code) is the implicit Free tier for indicator purposes —
  // mirrors PricingPage's own `effectivePlanCode` fallback rather than
  // inventing a second "unknown plan" bucket.
  return { kind: 'free', label: 'Free', secondaryText: 'Upgrade available', href: '/pricing' }
}
