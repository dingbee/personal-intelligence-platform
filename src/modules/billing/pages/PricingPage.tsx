import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useCurrentPlan } from '@/modules/plans/hooks/useCurrentPlan'
import { usePublicPlanCatalog } from '@/modules/plans/hooks/usePublicPlanCatalog'
import { startCheckout } from '@/modules/billing/api/billing'
import type { PublicPlanTier } from '@/modules/plans/api/plans'
import { formatFileSize } from '@/modules/library/utils/fileTypes'
import { FoundingProCard } from '@/modules/founding-pro/components/FoundingProCard'
import { appConfig } from '@/app/appConfig'
import { SurfaceCard } from '@/shared/components/ui/surface/SurfaceCard'
import { StatusBadge } from '@/shared/components/ui/feedback/StatusBadge'
import { Button } from '@/shared/components/ui/Button'
import { Spinner } from '@/shared/components/ui/Spinner'

// Phase 5C fix — this is a genuinely PUBLIC route (see router.tsx: it is
// deliberately NOT nested under the ProtectedRoute-wrapped '/' subtree,
// and therefore does not render inside AppShell/Sidebar). It must work
// for a completely anonymous visitor typing the URL directly, so this
// page supplies its own minimal header rather than relying on app chrome
// — and, since AuthProvider/WorkspaceProvider both wrap the whole router
// in App.tsx regardless of route nesting, useAuth()/useCurrentPlan() are
// still safe to call here for a signed-in visitor.
//
// Plan/quota numbers shown here always come from live `plans`/
// `plan_quotas` data (usePublicPlanCatalog), never hardcoded copy — an
// admin editing a plan's quota in Admin -> Plans & Commercial is
// reflected here immediately. Only plan-independent marketing copy (what
// ARRIYIA *is*) stays static. Both tables are readable by `anon` as of
// this same fix (0051_public_pricing_page_access.sql) — read-only,
// catalog/config data only, never user data; `plan_ai_providers` is
// deliberately NOT granted to anon (or selected by this page) — AI
// provider identity must never be visible to anyone but an admin.
//
// LOCKED PRODUCT DECISION — AI provider invisibility: this page must
// never name an AI provider, mention "provider selection," or imply a
// user chooses which model answers them. ARRIYIA picks a provider
// automatically, always, on every plan.
// Front-end-only presentational copy — never persisted, never a business
// decision baked into the database. Mirrors the pre-existing pattern
// CORE_FEATURES already established (marketing copy lives here; every
// number shown anywhere on this page still comes from usePublicPlanCatalog).
const CORE_FEATURES = ['Documents, notes, knowledge graph & conversations', 'AI memory & personalization']

// Capability-progression messaging: each plan sells a distinct job-to-be-done
// (headline + positioning + value prop + capability bullets) rather than
// reading as the same product at a different quota level. This is
// presentational copy only — the live numbers below (AI messages, storage,
// collaboration) still come exclusively from usePublicPlanCatalog and are
// never duplicated into this table.
const CARD_COPY: Record<string, { headline: string; positioning: string; valueProp: string; bullets: string[] }> = {
  free: {
    headline: 'Start Thinking Differently',
    positioning: 'Experience intelligence',
    valueProp: 'Get introduced to a more intelligent way of researching, thinking, planning and organizing what matters to you.',
    bullets: [
      'Explore ideas with AI-assisted thinking',
      'Organize conversations and emerging knowledge',
      'Get answers grounded in your own documents and notes',
      'Start building your personal knowledge foundation',
    ],
  },
  student: {
    headline: 'Learn, Research & Build Knowledge',
    positioning: 'For students, researchers and academic users.',
    valueProp: 'Understand difficult subjects, work through research, connect ideas and turn information into structured knowledge.',
    bullets: [
      'Break down complex academic material',
      'Get answers grounded in your own course materials',
      'Connect ideas across your knowledge',
      'Work through problems and ideas step by step',
      'Build a persistent research workspace',
    ],
  },
  pro: {
    headline: 'Your Personal Intelligence Partner',
    positioning: 'Think, create and decide with intelligence',
    valueProp: 'Go beyond asking AI questions. Research deeply, connect knowledge, reason through complex problems, plan with greater clarity and turn what you learn into action.',
    bullets: [
      'Conduct deeper research and synthesis',
      'Work across multiple sources and ideas',
      'Develop structured plans and decisions',
      'Build and use a persistent personal intelligence system',
      'Apply ARRIYIA across professional and creative work',
    ],
  },
}

function formatPrice(cents: number | null, currency: string): string | null {
  if (cents === null) return null
  return `${(cents / 100).toLocaleString(undefined, { style: 'currency', currency })}`
}

type PlanCta =
  | { kind: 'none' }
  | { kind: 'manage-billing' }
  | { kind: 'sign-up' }
  | { kind: 'checkout'; onClick: () => void; isStarting: boolean; error: string | null }

// Commercial Readiness — Student pricing-card fix. The self-serve plans
// with a working checkout intent (see pesapal-checkout/index.ts's own
// INTENT_PLAN_CODES). Student previously had no CTA at all because every
// CTA block below was gated on `isPro` specifically — the actual bug was
// at this layer (which plans get a checkout CTA), not a one-off missing
// button.
const CHECKOUT_PLAN_CODES = new Set(['pro', 'student'])

/**
 * Card hierarchy (capability-progression refresh): name -> capability
 * headline -> price -> positioning -> value proposition -> "what you can
 * accomplish" (capability bullets, marketing copy) -> "what's included"
 * (concrete features/limits, still 100% live-data-driven) -> CTA. The
 * exhaustive spec comparison (exact AI-message counts, exact storage,
 * collaboration) still moves to the "Compare plans" section below so a
 * card never has to choose between being readable and being complete —
 * it's readable, and complete detail is one click away.
 */
function PlanCard({ tier, isCurrent, cta }: { tier: PublicPlanTier; isCurrent: boolean; cta: PlanCta }) {
  const monthly = formatPrice(tier.monthlyPriceCents, tier.currency)
  const annual = formatPrice(tier.annualPriceCents, tier.currency)
  const isFree = tier.code === 'free'
  const isCheckoutable = CHECKOUT_PLAN_CODES.has(tier.code)
  const copy = CARD_COPY[tier.code]

  return (
    <SurfaceCard className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">{tier.name}</h2>
          {isCurrent && <StatusBadge label="Current plan" variant="info" />}
        </div>
        {copy && <p className="mt-1 text-sm font-semibold text-[var(--color-accent)]">{copy.headline}</p>}
        {isFree ? (
          <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">Free</p>
        ) : monthly ? (
          <div className="mt-1">
            <p className="text-2xl font-semibold text-[var(--color-ink)]">{monthly}/mo</p>
            {annual && <p className="text-xs text-[var(--color-ink-muted)]">or {annual}/yr</p>}
          </div>
        ) : (
          <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Pricing to be announced</p>
        )}
        <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{copy?.positioning ?? tier.description}</p>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">{copy?.valueProp ?? tier.description}</p>
      </div>

      {copy && (
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-muted)]">What you can accomplish</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm text-[var(--color-ink)]">
            {copy.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2">
        <p className="text-xs font-medium text-[var(--color-ink-muted)]">What's included</p>
        <ul className="flex flex-col gap-2 text-sm text-[var(--color-ink)]">
          {isFree && CORE_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
              {feature}
            </li>
          ))}
          {!isFree && (
            <li className="flex items-start gap-2">
              <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
              Everything in Free
            </li>
          )}
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
            {tier.aiMessagesPerMonth !== null ? `${tier.aiMessagesPerMonth.toLocaleString()} AI messages / month` : 'AI messages per month'}
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
            {tier.storageBytes !== null ? `${formatFileSize(tier.storageBytes)} storage` : 'Storage'}
          </li>
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
            {tier.collaboration
              ? tier.maxActiveCollaborators !== null
                ? `Invite ${tier.maxActiveCollaborators} collaborator${tier.maxActiveCollaborators === 1 ? '' : 's'} to your workspace`
                : 'Invite unlimited teammates to your workspace'
              : 'Single-owner workspace'}
          </li>
        </ul>
      </div>

      {isCheckoutable && cta.kind === 'manage-billing' && (
        <Link to="/settings">
          <Button variant="secondary">Manage billing</Button>
        </Link>
      )}

      {isCheckoutable && cta.kind === 'sign-up' && (
        <div className="flex flex-col gap-2">
          <Link to="/signup">
            <Button className="w-full">Sign up</Button>
          </Link>
          {/*
            V1 Free Access — registration is open (enforce_signup_-
            authorization, 0071_free_access_and_collaboration.sql, no
            longer requires an invitation of any kind). A visitor
            clicking "Sign up" from a checkout-eligible card lands on the
            same open /signup as everyone else and starts on Free; paid
            conversion is a separate, later step (PricingPage's own
            checkout CTA once signed in), never something signup itself
            grants.
          */}
          <p className="text-xs text-[var(--color-ink-muted)]">Free to sign up — subscribe to {tier.name} anytime afterward.</p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Already have an account? <Link to="/login" className="text-[var(--color-accent)] hover:underline">Log in</Link>
          </p>
        </div>
      )}

      {isCheckoutable && cta.kind === 'checkout' && (
        <div className="flex flex-col gap-2">
          <Button onClick={cta.onClick} disabled={cta.isStarting}>
            {cta.isStarting ? 'Starting checkout…' : `Subscribe to ${tier.name} (sandbox)`}
          </Button>
          <p className="text-xs text-[var(--color-ink-muted)]">Pesapal sandbox checkout — no real payment is processed.</p>
          {cta.error && <p className="text-xs text-[var(--color-danger-strong)]">{cta.error}</p>}
        </div>
      )}
    </SurfaceCard>
  )
}

export function PricingPage() {
  const { user, session } = useAuth()
  const { data: currentPlan, isLoading: planLoading } = useCurrentPlan()
  const { data: catalog, isLoading: catalogLoading } = usePublicPlanCatalog()
  // Per-plan-code state (not a single shared boolean/string) — Pro's and
  // Student's checkout buttons are independent controls on the same page;
  // starting one, or a failure on one, must never show as loading/errored
  // on the other.
  const [checkoutError, setCheckoutError] = useState<{ planCode: string; message: string } | null>(null)
  const [startingCheckoutFor, setStartingCheckoutFor] = useState<string | null>(null)

  // Phase 5B Pesapal Sandbox Billing — server resolves everything; this
  // click sends only a fixed intent, never a price or plan id (see
  // pesapal-checkout/index.ts). If Pesapal isn't configured for this
  // environment the function fails closed with a 501, surfaced here as an
  // honest inline error rather than a silent no-op or a fake success.
  async function handleCheckoutClick(planCode: 'pro' | 'student') {
    setCheckoutError(null)
    setStartingCheckoutFor(planCode)
    try {
      const { redirectUrl } = await startCheckout(planCode)
      window.location.href = redirectUrl
    } catch (err) {
      setCheckoutError({ planCode, message: err instanceof Error ? err.message : 'Checkout is unavailable right now. Please try again later.' })
      setStartingCheckoutFor(null)
    }
  }

  // V1 Free Access — assign_default_plan() (0071_free_access_and_-
  // collaboration.sql) now assigns 'free' on ordinary signup, but a
  // handful of accounts predating that trigger still have no active
  // user_plan_assignments row at all. getCurrentUserPlan() correctly
  // returns null for those users — null means "no explicit assignment,"
  // which this page must treat as the implicit Free default, not as an
  // unknown/excluded state. effectivePlanCode disambiguates: only a
  // *known* non-upgradable code suppresses the CTA below.
  const effectivePlanCode = currentPlan?.planCode ?? (user ? 'free' : null)

  // What a checkout-eligible card's CTA should be, resolved per target
  // plan code, in the exact order that avoids ever offering a checkout
  // that doesn't make sense: anonymous -> sign up; already on that exact
  // plan -> manage billing; a plan that can't self-serve-switch (Founding
  // Pro/Enterprise) or still loading -> nothing; anything else (Free, or
  // the other self-serve plan) -> the real checkout button. Same rule for
  // both Pro and Student — this was previously hardcoded to Pro only,
  // which is the actual reason Student had no CTA at all.
  function resolveCheckoutCta(targetPlanCode: 'pro' | 'student'): PlanCta {
    if (!user) return { kind: 'sign-up' }
    if (planLoading) return { kind: 'none' }
    if (effectivePlanCode === targetPlanCode) return { kind: 'manage-billing' }
    if (effectivePlanCode && ['founding_pro', 'enterprise'].includes(effectivePlanCode)) return { kind: 'none' }
    return {
      kind: 'checkout',
      onClick: () => void handleCheckoutClick(targetPlanCode),
      isStarting: startingCheckoutFor === targetPlanCode,
      error: checkoutError?.planCode === targetPlanCode ? checkoutError.message : null,
    }
  }

  return (
    <div className="min-h-screen min-h-dvh bg-[var(--color-canvas)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4 md:px-8">
        <span className="text-sm font-semibold tracking-tight text-[var(--color-ink)]">{appConfig.productName}</span>
        {session ? (
          <Link to="/hub" className="text-sm text-[var(--color-accent)] hover:underline">
            ← Back to ARRIYIA
          </Link>
        ) : (
          <Link to="/login" className="text-sm text-[var(--color-accent)] hover:underline">
            Log in
          </Link>
        )}
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 md:px-8">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Plans</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            A personal intelligence workspace that grows with you — from exploring ideas to deep research, planning and decision-making.
          </p>
        </div>

        {/*
          Rendering-gap fix — FoundingProCard was previously nested INSIDE
          the `catalogLoading || !catalog` branch below, so a slow, erroring,
          or hung usePublicPlanCatalog() request took the entire grid down
          with it: Free/Student/Pro AND Founding Pro all disappeared
          together behind an indefinite spinner. Founding Pro Programme
          Phase 2 already made FoundingProCard independent of the public
          plan catalog fetch (it never comes from `catalog`; founding_pro's
          price/capacity/eligibility all come from Founding-Pro-specific
          reads — get_founding_pro_public_capacity, the caller's own
          application/membership rows), but the JSX nesting undid that
          independence. FoundingProCard now renders unconditionally as its
          own sibling, last in the grid (Free/Student/Pro, then Founding
          Pro) — only the ordinary catalog-driven cards wait on
          catalogLoading, since those genuinely need real catalog data
          (price/quotas) to render at all.
        */}
        <div data-testid="plan-cards" className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {catalogLoading || !catalog ? (
            <div className="col-span-full flex justify-center py-12">
              <Spinner />
            </div>
          ) : (
            catalog
              .filter((tier) => tier.code !== 'founding_pro')
              .map((tier) => (
                <PlanCard
                  key={tier.code}
                  tier={tier}
                  isCurrent={effectivePlanCode === tier.code}
                  cta={CHECKOUT_PLAN_CODES.has(tier.code) ? resolveCheckoutCta(tier.code as 'pro' | 'student') : { kind: 'none' }}
                />
              ))
          )}
          <FoundingProCard />
        </div>

        {!catalogLoading && catalog && (
          <details className="rounded-card border border-[var(--color-border)] bg-[var(--surface-inset)] p-4">
            <summary className="cursor-pointer text-sm font-medium text-[var(--color-ink)]">Compare plans / full capabilities</summary>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[var(--color-ink-muted)]">
                    <th className="pb-2 pr-4 font-medium">Plan</th>
                    <th className="pb-2 pr-4 font-medium">Price</th>
                    <th className="pb-2 pr-4 font-medium">AI messages / month</th>
                    <th className="pb-2 pr-4 font-medium">Storage</th>
                    <th className="pb-2 font-medium">Collaboration</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((tier) => {
                    const monthly = formatPrice(tier.monthlyPriceCents, tier.currency)
                    return (
                      <tr key={tier.code} className="border-t border-[var(--color-border)]">
                        <td className="py-2 pr-4 text-[var(--color-ink)]">{tier.name}</td>
                        <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                          {tier.code === 'free' ? 'Free' : tier.code === 'founding_pro' ? 'By application' : monthly ? `${monthly}/mo` : 'To be announced'}
                        </td>
                        <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                          {tier.aiMessagesPerMonth !== null ? tier.aiMessagesPerMonth.toLocaleString() : '—'}
                        </td>
                        <td className="py-2 pr-4 text-[var(--color-ink-muted)]">
                          {tier.storageBytes !== null ? formatFileSize(tier.storageBytes) : '—'}
                        </td>
                        <td className="py-2 text-[var(--color-ink-muted)]">
                          {tier.collaboration
                            ? tier.maxActiveCollaborators !== null
                              ? `${tier.maxActiveCollaborators} collaborator${tier.maxActiveCollaborators === 1 ? '' : 's'}`
                              : 'Unlimited'
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
