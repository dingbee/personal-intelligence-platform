import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/modules/auth/useAuth'
import { useCurrentPlan } from '@/modules/plans/hooks/useCurrentPlan'
import { usePublicPlanCatalog } from '@/modules/plans/hooks/usePublicPlanCatalog'
import { startProCheckout } from '@/modules/billing/api/billing'
import type { PublicPlanTier } from '@/modules/plans/api/plans'
import { formatFileSize } from '@/modules/library/utils/fileTypes'
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
const CORE_FEATURES = ['Documents, notes, knowledge graph & conversations', 'AI memory & personalization']

function formatPrice(cents: number | null, currency: string): string | null {
  if (cents === null) return null
  return `${(cents / 100).toLocaleString(undefined, { style: 'currency', currency })}`
}

type ProCta =
  | { kind: 'none' }
  | { kind: 'manage-billing' }
  | { kind: 'sign-up' }
  | { kind: 'upgrade'; onClick: () => void; isStarting: boolean; error: string | null }

function PlanCard({ tier, isCurrent, proCta }: { tier: PublicPlanTier; isCurrent: boolean; proCta: ProCta }) {
  const monthly = formatPrice(tier.monthlyPriceCents, tier.currency)
  const annual = formatPrice(tier.annualPriceCents, tier.currency)
  const isFree = tier.code === 'free'
  const isPro = tier.code === 'pro'
  const isFoundingPro = tier.code === 'founding_pro'

  return (
    <SurfaceCard className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">{tier.name}</h2>
          {isCurrent && <StatusBadge label="Current plan" variant="info" />}
        </div>
        {isFree ? (
          <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">$0</p>
        ) : monthly ? (
          <div className="mt-1">
            <p className="text-2xl font-semibold text-[var(--color-ink)]">{monthly}/mo</p>
            {annual && <p className="text-xs text-[var(--color-ink-muted)]">or {annual}/yr</p>}
          </div>
        ) : isFoundingPro ? (
          <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Invite only</p>
        ) : (
          <p className="mt-1 text-lg font-semibold text-[var(--color-ink)]">Pricing to be announced</p>
        )}
        {tier.description && <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{tier.description}</p>}
      </div>

      <ul className="flex flex-1 flex-col gap-2 text-sm text-[var(--color-ink)]">
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
          {tier.collaboration ? 'Invite teammates to your workspace' : 'Single-owner workspace'}
        </li>
        {isFoundingPro && (
          <li className="flex items-start gap-2">
            <span aria-hidden className="mt-0.5 text-[var(--color-accent)]">✓</span>
            Terms locked in independently of future Pro changes
          </li>
        )}
      </ul>

      {isPro && proCta.kind === 'manage-billing' && (
        <Link to="/settings">
          <Button variant="secondary">Manage billing</Button>
        </Link>
      )}

      {isPro && proCta.kind === 'sign-up' && (
        <div className="flex flex-col gap-2">
          <Link to="/signup">
            <Button className="w-full">Sign up to get started</Button>
          </Link>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Already have an account? <Link to="/login" className="text-[var(--color-accent)] hover:underline">Log in</Link>
          </p>
        </div>
      )}

      {isPro && proCta.kind === 'upgrade' && (
        <div className="flex flex-col gap-2">
          <Button onClick={proCta.onClick} disabled={proCta.isStarting}>
            {proCta.isStarting ? 'Starting checkout…' : 'Upgrade to Pro (sandbox)'}
          </Button>
          <p className="text-xs text-[var(--color-ink-muted)]">Pesapal sandbox checkout — no real payment is processed.</p>
          {proCta.error && <p className="text-xs text-[var(--color-danger-strong)]">{proCta.error}</p>}
        </div>
      )}

      {isFoundingPro && (
        <p className="text-xs text-[var(--color-ink-muted)]">
          Founding Pro is assigned to early ARRIYIA members and isn't available through self-serve checkout.
        </p>
      )}
    </SurfaceCard>
  )
}

export function PricingPage() {
  const { user, session } = useAuth()
  const { data: currentPlan, isLoading: planLoading } = useCurrentPlan()
  const { data: catalog, isLoading: catalogLoading } = usePublicPlanCatalog()
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [isStartingCheckout, setIsStartingCheckout] = useState(false)

  // Phase 5B Pesapal Sandbox Billing — server resolves everything; this
  // click sends only a fixed intent, never a price or plan id (see
  // pesapal-checkout/index.ts). If Pesapal isn't configured for this
  // environment the function fails closed with a 501, surfaced here as an
  // honest inline error rather than a silent no-op or a fake success.
  async function handleUpgradeClick() {
    setCheckoutError(null)
    setIsStartingCheckout(true)
    try {
      const { redirectUrl } = await startProCheckout()
      window.location.href = redirectUrl
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Checkout is unavailable right now. Please try again later.')
      setIsStartingCheckout(false)
    }
  }

  // A real "Free" user is never actually assigned plans.code = 'free' —
  // assign_default_plan() (0044_commercial_schema_reconciliation.sql)
  // only ever assigns 'beta' on signup, or nothing at all for accounts
  // that predate that trigger (confirmed live: 2 of 5 users have no
  // active user_plan_assignments row). getCurrentUserPlan() correctly
  // returns null for those users — null means "no explicit assignment,"
  // which this page must treat as the implicit Free default, not as an
  // unknown/excluded state. Previously `!currentPlan` was bundled into
  // the same branch as Founding Pro/Enterprise, which hid the Pro CTA
  // entirely for exactly this cohort. effectivePlanCode disambiguates:
  // only a *known* non-upgradable code suppresses the CTA now.
  const effectivePlanCode = currentPlan?.planCode ?? (user ? 'free' : null)

  // What the Pro card's CTA should be, resolved once, in the exact order
  // that avoids ever offering an upgrade that doesn't make sense:
  // anonymous -> sign up; already Pro -> manage billing; a plan that
  // can't (yet) become Pro (Founding Pro/Enterprise) or still loading ->
  // nothing; anything else (Free/Beta) -> the real checkout button.
  function resolveProCta(): ProCta {
    if (!user) return { kind: 'sign-up' }
    if (planLoading) return { kind: 'none' }
    if (effectivePlanCode === 'pro') return { kind: 'manage-billing' }
    if (effectivePlanCode && ['founding_pro', 'enterprise'].includes(effectivePlanCode)) return { kind: 'none' }
    return { kind: 'upgrade', onClick: handleUpgradeClick, isStarting: isStartingCheckout, error: checkoutError }
  }
  const proCta = resolveProCta()

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
            Free is useful on its own. Pro adds capacity and collaboration when you need it.
          </p>
        </div>

        {catalogLoading || !catalog ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {catalog
              // Founding Pro must never present as an ordinary public
              // checkout option — only shown here when it's the viewer's
              // own plan, so they can see their current terms. No
              // accidental upgrade/downgrade path out of Founding Pro
              // exists anywhere on this page.
              .filter((tier) => tier.code !== 'founding_pro' || currentPlan?.planCode === 'founding_pro')
              .map((tier) => (
                <PlanCard key={tier.code} tier={tier} isCurrent={effectivePlanCode === tier.code} proCta={tier.code === 'pro' ? proCta : { kind: 'none' }} />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
