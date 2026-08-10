# Phase 5C — Commercial UX Exposure & Operator Control: Final Report

Date: 2026-08-10
Repository: `dingbee/personal-intelligence-platform`
Branch: `phase5c-commercial-ux-exposure`, created from the verified baseline `phase5b-pesapal-sandbox-billing @ d24bb84`

## 1. Baseline

Verified before any work: repo `dingbee/personal-intelligence-platform`, branch `phase5b-pesapal-sandbox-billing`, HEAD `d24bb84` ("Phase 5B: Pesapal sandbox billing integration"), working tree clean. `dingbee/mtoni-river-lodge` was never touched.

## 2. Audit — what commercial surfaces actually existed before this phase

Everything the operator couldn't find **did exist in the codebase** — Phase 5A/5B genuinely built it. The finding of this audit is that almost none of it was *reachable*:

| Surface | Existed? | Reachable from the running app? |
|---|---|---|
| `/pricing` route | Yes (`router.tsx`) | **No** — zero links anywhere in the app pointed to it. Only way in was typing the URL. |
| `PricingPage` component | Yes, fully built | Same as above |
| `BillingCard` | Yes, rendered inside `SettingsPage` | **Yes** — Settings has a nav link and the card was already there. The operator's report of not finding it was likely tied to not finding `/pricing` from within it (its "View plans" link goes to a page that then had no way back into normal navigation either). |
| `BillingReturnPage` (`/billing/return`) | Yes | Only reachable via a real checkout redirect (no direct nav needed) |
| Quota-denial upgrade CTAs (AI quota, collaboration) | Yes, already wired to `/pricing` | Yes, in context |
| `AdminPlansPage` (`/admin/plans`) | Yes, fully built (pricing/quotas/features/AI-provider matrix) | Yes — linked from `AdminDashboardPage`, gated by `RequireAdmin` |
| `pesapal-checkout` / `pesapal-ipn` Edge Functions | Yes, deployed and `ACTIVE` | N/A (server-side) |
| `subscriptions` / `subscription_events` / `billing_customers` | Yes | N/A (server-side) |

**Root cause, concretely**: `Sidebar.tsx`'s `navItems` array (the single source of truth for both the desktop sidebar and the mobile nav drawer — they share it) had no `/pricing` entry. That is the entire reason the operator couldn't find pricing, checkout, or by extension anything downstream of it — everything else the operator listed as missing was one click past a page nobody could reach.

## 3. What was missing (genuine gaps, not just discoverability)

Beyond the pure navigation gap, this audit found three real correctness issues while reading the pages the operator couldn't reach:

1. **A locked-decision violation still in the code.** `PricingPage`'s Pro tier listed "AI provider selection" as a feature bullet — a leftover from before the Phase 5A product decision that AI provider identity must be invisible to every user on every plan. This directly contradicted this phase's own locked instructions and had to be removed, not just hidden.
2. **Hardcoded, driftable quota copy.** Storage/AI-message numbers on `/pricing` were static strings ("500 MB", "5 GB") rather than reads of live `plan_quotas` — an admin editing a quota in Admin → Plans & Commercial would silently stop matching what `/pricing` told users.
3. **A latent Founding Pro exposure.** The Pro tier's "Upgrade" CTA was gated only on `!isCurrent`, not on the viewer's actual plan being upgrade-eligible — a Founding Pro (or Beta/Enterprise) viewer would have been shown an "Upgrade to Pro" button that made no sense and, worse, was a real accidental path toward Founding Pro's protected status being confused with an ordinary Pro subscription.

Plus one missing denial path: an upload blocked by the storage-quota trigger surfaced only a raw Postgres exception message, with no upgrade path at all (Task 6 explicitly calls this out).

## 4. What was exposed / fixed

**Discoverability (the primary fix)**
- Added a single `Pricing` entry to `Sidebar.tsx`'s shared `navItems` — the one nav array both desktop sidebar and mobile drawer already render from. This alone makes `/pricing`, and everything reachable from it, discoverable for the first time.
- Relabeled `AdminDashboardPage`'s link from "Plans & Quotas →" to "Plans & Commercial →", matching what the page actually is (pricing + quotas + features + AI provider allocation), not just quotas.

**PricingPage rebuilt on live data, not static copy**
- Added `getPublicPlanCatalog()` (`src/modules/plans/api/plans.ts`) — a plain authenticated read joining `plans` + `plan_quotas` (never `plan_ai_providers` — provider identity must never reach this page, even as a count). Backed by `usePublicPlanCatalog()`.
- `PricingPage` now renders real AI-message and storage numbers, real monthly/annual prices when `plans.monthly_price_cents`/`annual_price_cents` are set (still `NULL` today — shown honestly as "Pricing to be announced," not a fabricated number, not "Contact us" now that a real self-serve sandbox checkout exists).
- Removed the "AI provider selection" bullet entirely.
- **Founding Pro is no longer shown to ordinary users.** It only renders when the viewer's own current plan is `founding_pro` — never as a third, ordinary-looking tier next to Free/Pro. No upgrade or downgrade control exists on it anywhere on this page.
- The Pro tier's CTA is now genuinely plan-aware: `isEligibleToUpgrade` requires the viewer's plan to be loaded (never renders mid-load) and explicitly excludes `pro`/`founding_pro`/`enterprise` — a Founding Pro viewer sees no Pro upgrade button at all. A current Pro user sees **"Manage billing"** (→ `/settings`) instead of an upgrade button, exactly per Task 3's example.

**Settings → Billing**
- Added an AI-message usage indicator (`useAiMessageUsage`, reusing the exact `quotaService.checkQuota` resolution the chat send-path already enforces — no second usage-computation path) alongside the existing storage indicator.
- Added a renewal-date line for active, non-cancelling subscriptions (previously only cancellation state was shown).
- Added a storage near/at-limit banner with an "Upgrade to Pro →" link, shown only when the viewer isn't already on a plan with nothing to upgrade to.

**Upgrade CTAs — full audit**
- AI quota exhaustion (`ChatPage`) → already wired to `/pricing`, unchanged, still correct.
- Collaboration restriction (`WorkspaceMemberRoster`) → already wired to `/pricing`, unchanged, still correct.
- Storage restriction → was previously a dead end (raw trigger exception text, no path forward). `UploadDropzone` now detects the storage-quota trigger's known error text and replaces it with "You've reached your storage limit." plus an inline "Upgrade to Pro →" link. The trigger itself (`enforce_storage_quota()`, the actual enforcement boundary) was not touched — this only changes what's displayed for one known failure shape.

**Admin → Plans & Commercial**
- Confirmed by full read-through: already provides plan catalog, pricing metadata (monthly/annual/currency/active), quota editing (plan-wide, with an explicit affected-user-count confirmation dialog), feature editing (collaboration is just another `feature:` quota key, same generic UI), and the AI-provider allocation matrix (provider names visible here only, by design). Gated by `RequireAdmin`. One small copy fix: the page's own description said pricing was "informational until a payment provider is wired up" — stale since Phase 5B; updated to state that Pesapal sandbox checkout now reads this same pricing.

## 5. Final routes

Unchanged from Phase 5B (no new routes were needed — everything already existed; this phase is about reaching them):

- `/pricing` — plan comparison + Pro checkout CTA (authenticated only — see §9 for why)
- `/billing/return` — post-checkout confirmation, polls verified state
- `/settings` — includes `BillingCard`
- `/admin/plans` — Plans & Commercial, admin-only

## 6. Final user-facing commercial journey

`Sidebar → Pricing → (Free: see plan, no CTA needed / Pro-eligible: "Upgrade to Pro (sandbox)") → Pesapal Sandbox hosted checkout → /billing/return (polls real subscription state, never assumes success) → Settings → Billing shows the confirmed plan, AI/storage usage, and "Billed via Pesapal (Sandbox)"`. A Pro user returning to `/pricing` later sees "Manage billing" instead of another checkout button. In-context upgrade CTAs exist at all three quota/feature denial points (AI messages, collaboration, storage).

## 7. Final admin commercial journey

`Sidebar → Admin (admin-only nav item, unchanged from before this phase) → Founder Command Center → "Plans & Commercial →" → per-plan cards for Free/Pro/Founding Pro/Beta/Enterprise, each editable: commercial (price/currency/active), quotas & features (plan-wide, confirmation-gated), AI provider allocation (provider names visible here only)`.

## 8. Collaboration enforcement

Unchanged, re-verified live this phase: `invite_to_workspace` re-checks `has_feature(auth.uid(), 'collaboration')` server-side on every call — this is the actual boundary, not client-side button hiding. Live-confirmed this phase: Free's `feature:collaboration` quota_limit is `0`, Pro's and Founding Pro's are `1`. The UI now additionally surfaces this correctly on `/pricing` (derived from the same `plan_quotas` row, not separate copy).

## 9. Provider-allocation enforcement

Unchanged, re-verified live this phase: Free has exactly 1 active row in `plan_ai_providers`; Pro and Founding Pro each have more than 1. `admin_set_plan_ai_provider` remains `is_platform_admin()`-gated. Provider identity is now confirmed absent from every page an ordinary user can reach — `getPublicPlanCatalog()` (backing `/pricing`) deliberately never selects `plan_ai_providers`, and the stale "AI provider selection" bullet that violated this was removed from `/pricing` this phase.

## 10. Pesapal sandbox status

Unchanged from Phase 5B — still sandbox-only by construction (`PESAPAL_ENV=sandbox` hard-required, `production` explicitly rejected in both Edge Functions), no production credentials exist anywhere in this codebase, no production IPN registered. This phase did not touch `pesapal-checkout`/`pesapal-ipn` — it only made the existing, correctly-wired checkout button reachable and honest about being a sandbox flow ("Pesapal sandbox checkout — no real payment is processed" is shown directly under the button).

## 11. Tests

- Extended `src/modules/plans/api/plans.test.ts` with 4 new cases for `getPublicPlanCatalog`: correct join/normalization, `collaboration: false` derived from a `0` quota_limit (not a default), `null` (not `0`) for an absent quota row, and empty-array-not-throw on query failure.
- Full pre-existing suite: **254 files, 2015 tests, all passing** (2011 carried over from Phase 5B + 4 new).
- Re-ran live against production (project `uzshazetfkjkrdnxwjtl`), confirming no regression from this phase's changes:
  - **Founding Protection Test** — bumped Pro's `ai_messages`, confirmed Founding Pro's unchanged, restored Pro. Passed.
  - **Commercial control security test** — Free=1/Pro>1/Founding Pro>1 active AI providers; `admin_set_plan_ai_provider` still `authenticated`-grantable only because it's self-gated internally. Passed.
  - **Storage downgrade-safety test** — no `DELETE` trigger exists on `documents`/`assets`. Passed.
  - **Pesapal billing security test (structural)** — `authenticated` cannot write `pesapal_checkout_orders`, `anon` cannot read it, `apply_subscription_event` remains `service_role`-only. Passed.

No new SQL test file was needed this phase — this phase changed no database objects (schema, RLS, functions, triggers) at all, so re-running the existing Phase 4/5A/5B tests unchanged is the correct verification, not writing new ones.

## 12. Build/lint/typecheck results

- `tsc -b`: clean.
- `vitest run`: 254 files, 2015 tests, all passing.
- `oxlint`: 0 warnings, 0 errors (970 files).
- `vite build`: succeeds (same pre-existing large-chunk warning, unrelated to this phase).

## 13. Verification boundaries — what was and wasn't actually clicked through

This environment has no browser/GUI access and no outbound network path to Pesapal (established in Phase 5B and unchanged). Nothing in this report claims to have been clicked through in a real browser. What follows is exactly what was and wasn't done:

- **Code-verified**: every navigation path, every gate (`RequireAdmin`, `ProtectedRoute`, plan-code eligibility check), every CTA's `to=` target, and the full data flow from `plan_quotas` through `getPublicPlanCatalog` to `PricingPage`'s rendered output — read end-to-end, not assumed from a prior report.
- **Live-database-verified**: the four security/regression SQL checks in §11, executed for real against production.
- **Automated-test-verified**: the 4 new `getPublicPlanCatalog` unit tests plus the full 2015-test regression suite.
- **Not verified — no browser available**: that `/pricing` visually renders correctly, that the sidebar link actually appears and is clickable, that `RequireAdmin`'s redirect is visually smooth, that the Founding Pro card genuinely never flashes on screen for a non-Founding-Pro user before data loads. The `isEligibleToUpgrade` gate is written specifically to prevent that last case (it requires `!planLoading` before rendering any CTA), but this is a code-level guarantee, not an observed one.

If a genuine end-to-end click-through is required before this is considered done, that needs either a browser-capable environment or the user's own verification — stated plainly rather than claimed.

## 14. Remaining blockers before Phase 5D (production billing)

Unchanged from Phase 5B's own list, none of which this phase touched or was asked to touch:

1. Real Pesapal production merchant credentials (not obtainable from this environment — no network path to Pesapal at all, sandbox or production).
2. Production IPN registration.
3. Real Pro pricing decided and entered via Admin → Plans & Commercial (still `NULL`).
4. Founding Pro's actual grandfathered commercial terms decided.
5. Refund/cancellation/payment-failure policy decided (the technical state machine already supports whatever is chosen).
6. A genuine end-to-end browser click-through of the flow described in §6/§7, in an environment that has one.
