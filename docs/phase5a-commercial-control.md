# Phase 5A — Commercial Control & Billing Integration Preparation: Final Report

Date: 2026-08-10
Repository: `dingbee/personal-intelligence-platform`
Branch: `phase4-commercial-architecture` (continued from Phase 4, not a new branch — this prompt's baseline)
Commit: `8197a2c` — "Phase 5A: commercial control & billing integration preparation"

No payment provider was implemented or wired (Pesapal, Flutterwave, Paddle, Stripe all explicitly out of scope, per the directive). Pesapal remains the provider under evaluation and is not touched by this phase.

## Files changed

Modified: `src/modules/admin/api/adminApi.ts`, `src/modules/admin/hooks/useAdminData.ts`, `src/modules/admin/pages/AdminPlansPage.tsx` + `.test.ts`, `src/modules/ai/router/resolveProviderChain.ts` + `.test.ts`, `src/modules/ai/router/useProviderChain.ts`, `src/modules/intelligence/components/ExplainAnswerPanel.tsx`, `src/modules/plans/api/plans.ts`, `src/modules/settings/pages/AdvancedSettingsPage.tsx`, `src/modules/settings/pages/SettingsPage.tsx`, `src/shared/types/database.ts`, `supabase/tests/founding_protection_test.sql`.

Added: `src/modules/ai/providers/api/planProviders.ts`, `src/modules/ai/providers/usePlanAllowedProviders.ts`, `supabase/migrations/0049_plan_commercial_control.sql`, `supabase/tests/commercial_control_security_test.sql`, `supabase/tests/storage_downgrade_safety_test.sql`.

Deleted: `src/modules/plans/entitlements.ts` + `.test.ts` (the `canSelectProvider` plan-code gate — its sole purpose was letting Pro/Enterprise users pick a provider, which this phase forbids entirely; see below).

Nothing else changed — confirmed via `git status`/`git diff --stat` before committing (20 files, 978 insertions, 141 deletions).

## Database changes

One migration, `0049_plan_commercial_control.sql`, applied live and verified against production (`uzshazetfkjkrdnxwjtl`):

- `plans` gains `monthly_price_cents`, `annual_price_cents` (both nullable, no value seeded — no pricing decision has been made), `currency` (default `'USD'`).
- New table `plan_ai_providers` (plan_id, provider_id, priority, active) — the plan → allowed-AI-provider matrix. RLS: authenticated-read-all, zero client write policies.
- `admin_set_plan_ai_provider(plan_id, provider_id, active, priority)` — SECURITY DEFINER, `is_platform_admin()`-gated, upsert.
- `admin_update_plan_commercial(plan_id, monthly_price_cents, annual_price_cents, currency, active)` — same gating pattern, writes only to `plans`' commercial columns.
- Seed data: Free → exactly one active provider (`anthropic`, chosen arbitrarily — an admin can change it any time); Beta/Pro/Founding Pro/Enterprise → all three registered chat providers (`anthropic`, `openai`, `google`), preserving today's de facto unrestricted access for those plans so they don't regress to zero providers.

## Commercial architecture changes

**AI provider invisibility (the central product decision this phase enforces).** Users must never see which AI provider or model answered:
- `ExplainAnswerPanel` no longer renders `Model: ...` — the raw provider model id (e.g. `claude-sonnet-5`) is no longer shown anywhere in the app.
- `AdvancedSettingsPage` (the one place a provider could be seen/chosen) and its entry point on `SettingsPage` are now admin-only, regardless of plan. `canSelectProvider` — the mechanism that used to grant this to Pro/Enterprise — is deleted; there is no code path left that lets plan code decide provider visibility.
- The main chat composer (`ChatPage`) was already provider-neutral before this phase and needed no change.

**Plan → AI provider allocation.** `resolveProviderChain` (the pure routing function) gained an optional `planAllowedProviderIds` filter and `planProviderPriority` ordering signal — both additive and backward-compatible (`undefined` preserves every existing caller's behavior exactly, which is why the existing 22-test suite for this function needed zero changes). `useProviderChain` (the hook every real request path uses) now always resolves the caller's plan's allocation via the new `usePlanAllowedProviders` hook and fails closed to `[]` while that query is loading — an unresolved plan can never be mistaken for "no restriction," so the Free = one-provider guarantee can't be raced.

**Admin → Plans & Commercial.** `AdminPlansPage` (renamed from "Plans & Quotas") now shows, per plan: commercial metadata (price/currency/active, editable), quotas/features (unchanged generic list), the AI provider allocation matrix (enable/disable + priority per registered provider), and live user counts. No payment processing lives here.

**Storage downgrade safety.** No new logic was needed — `enforce_storage_quota()` (Phase 4) was already a `BEFORE INSERT`-only trigger, and no `DELETE`/`UPDATE` trigger touches `documents`/`assets` on a plan change anywhere in the codebase. A downgrade therefore already: preserves all existing data, blocks new uploads once usage exceeds the new (lower) limit, and immediately allows uploads again on re-upgrade. This was verified live rather than assumed (see Security verification).

**Backward compatibility preserved, unchanged:** `resolve_effective_quota_limit`, `consume_quota`, `user_quota_overrides`, every existing `admin_*` RPC's authorization pattern, workspace RLS/isolation, Founding Pro isolation, the Phase 4 billing tables/webhook, Phase 1–3 auth/onboarding/pagination/RLS work. No unrelated refactoring was performed.

## Security verification (all executed live against production, not just designed)

- **Founding Protection Test extended** (`supabase/tests/founding_protection_test.sql`): the existing quota-isolation block plus a new block — flipped Pro's `google` provider allocation off, confirmed Founding Pro's stayed unchanged, restored Pro's original value. Passed.
- **Commercial control security test** (new, `supabase/tests/commercial_control_security_test.sql`): confirmed live — Free has exactly 1 active provider, Pro and Founding Pro each have 3; `admin_set_plan_ai_provider`/`admin_update_plan_commercial` both contain an `is_platform_admin()` check in their body and are unreachable by `anon` at the grant level; the collaboration matrix (Free=off, Pro=on, Founding Pro=on) is unchanged. Passed.
- **Storage downgrade safety test** (new, `supabase/tests/storage_downgrade_safety_test.sql`): confirmed live — no `DELETE` trigger exists on `documents`/`assets`, and the storage-quota triggers are `INSERT`-only. Passed.
- No ordinary authenticated user can self-grant a plan, alter provider allocation, or alter pricing — every write path is a `SECURITY DEFINER` RPC re-checking `is_platform_admin()`, exactly the existing `admin_*` pattern; this phase introduced no second, competing entitlement mechanism.

## Tests

- 6 new pure-logic tests in `resolveProviderChain.test.ts` covering the plan-filtering behavior (Free-shaped single-provider set, Pro-shaped multi-provider set, preferred-provider exclusion, empty-list fail-closed behavior, backward-compatible `undefined`, plan-priority ordering).
- `AdminPlansPage.test.ts` updated for the two new hook dependencies and pricing fixture fields; all 6 pre-existing cases pass unchanged.
- 3 SQL verification scripts under `supabase/tests/` (see above), all executed live and passing.
- Full pre-existing suite: 2011/2011 tests passing (net unchanged from Phase 4 — 6 tests removed with `entitlements.test.ts`, 6+ added, plus the resolveProviderChain additions), no regressions.

Mapped against the 12 required test scenarios: 1–6 and 11 are the SQL scripts + the vitest `planAllowedProviderIds` block; 7 (storage limits resolve correctly) is unchanged Phase 4 behavior + the new downgrade-safety test; 8 is the extended Founding Protection Test; 9–10 (existing quota resolution/admin authorization intact) are the full regression suite passing unchanged; 12 (pricing metadata doesn't alter entitlement logic) was verified by exhaustive grep — `monthly_price_cents`/`annual_price_cents` are read only by the admin API/hook/page/type layer, nowhere in any entitlement, quota, or routing path.

## Build/lint results

- `tsc -b`: clean.
- `oxlint`: 0 warnings, 0 errors (964 files).
- `vitest run`: 254 files, 2011 tests, all passing.
- `vite build`: succeeds (same pre-existing large-chunk warning as Phase 4, unrelated to this phase).

No browser verification was performed this phase — the "no provider-selection UI remains exposed to ordinary users" requirement was verified by source review and the deletion of the only code path that ever rendered one (`canSelectProvider`), not by a live UI check. Stating this explicitly per the instruction not to claim browser verification that didn't happen.

## Remaining provider-dependent work

Everything that requires an actual payment provider decision remains exactly where Phase 4 left it — untouched by design:
- Payment provider selection (Pesapal is under evaluation; not implemented here).
- Real hosted checkout, webhook wiring, and the `/pricing` page's "Checkout coming soon" state.
- Write-path billing tests (duplicate webhook, out-of-order events, cancellation transitions) — still code-reviewed only, not live-executed, per Phase 4's report.
- Actual pricing numbers — still `NULL` everywhere; this phase only prepared the columns, per the explicit instruction not to invent them.

## Recommended next phase (5B)

1. Finalize the payment provider decision (Pesapal or otherwise) and wire the Phase 4 webhook Edge Function's `normalizeProviderEvent` for its real payload shape.
2. Enter real pricing into the new commercial metadata via the Plans & Commercial admin page once pricing is decided.
3. Replace `/pricing`'s "Checkout coming soon" with the provider's real hosted checkout link.
4. Run the write-path billing test suite against a Supabase branch or staging project before enabling real transactions.
