# Phase 4 — ARRIYIA Commercial Architecture & Billing: Final Report

Date: 2026-08-10
Repository: `dingbee/personal-intelligence-platform`
Branch: `phase4-commercial-architecture` (based on `phase3-quality-hardening` @ `7d3fbd7`)
Commit: `d6c7ba5` — "Phase 4: ARRIYIA commercial architecture and billing foundation"

## 1. Repository / branch / commits

- Baseline verified before any work: `phase3-quality-hardening` @ `7d3fbd7773c6b99beb6e1f2f7eed15c3854910bb7`, working tree clean — exact match to the required baseline.
- All work done on `phase4-commercial-architecture`, created from that baseline. `main` and `phase3-quality-hardening` were never touched.
- One commit (`d6c7ba5`), 23 files changed, pushed to `origin/phase4-commercial-architecture`. Working tree is clean.

## 2. Migrations added

Five migrations, applied live and verified against production (project `uzshazetfkjkrdnxwjtl`) before being written to disk in the repo:

- `0044_commercial_schema_reconciliation.sql` — codifies the previously untracked `plans`/`plan_quotas`/`beta_invites`/`user_plan_assignments`/`quota_usage` schema exactly as it existed live (documented no-op against production), plus two zero-behavior-change hardening fixes (`search_path` on `assign_default_plan`, revoking latent unusable write grants).
- `0045_founding_pro_plan.sql` — adds `founding_pro` as an independent `plans` row with its own `plan_quotas`.
- `0046_feature_entitlements_and_storage_quota.sql` — seeds `feature:collaboration` and `storage_bytes` quota keys for all plans; adds `has_feature()`, `calculate_user_storage_usage()`, `enforce_storage_quota()` (BEFORE INSERT trigger on `documents`/`assets`); gates `invite_to_workspace` on collaboration entitlement.
- `0047_billing_tables_and_subscription_event_function.sql` — adds `billing_customers`, `subscriptions`, `subscription_events`; adds `apply_subscription_event()` (service-role-only) and `admin_get_user_subscription()`.
- `0048_tighten_storage_trigger_grants.sql` — closes an advisory finding raised by 0046 (revokes latent anon/authenticated EXECUTE on the storage trigger function).

## 3. Structures reconciled

`plans`, `plan_quotas`, `beta_invites`, `user_plan_assignments`, `quota_usage` had never had a `CREATE TABLE` in migration history despite existing live — this is now closed. `assign_default_plan()` and `is_beta_invited()` were reconciled against their live bodies (one hardening fix applied to the former; the latter was already correct).

## 4. Commercial plan model

Three tiers: **Free**, **Pro**, **Founding Pro** — plus the pre-existing `beta`/`enterprise` codes, left untouched. Founding Pro is a real, independent `plans` row with its own `plan_quotas`, not a flag on Pro. Verified live: editing Pro's `plan_quotas` (ai_messages, storage_bytes) never changes Founding Pro's rows, because `plan_quotas` is keyed by `plan_id`.

## 5. Feature-entitlement model

Centralized around the existing `plan_quotas` table: a boolean capability is a `quota_key` under a `feature:` namespace, resolved through the existing `resolve_effective_quota_limit()` — no second entitlement table. `has_feature(user_id, key)` is the one new primitive; `src/modules/plans/api/plans.ts`'s `hasFeature()` + `useHasFeature()` hook expose it client-side. `collaboration` is the only new feature flag; `provider_selection` remains the existing client-side `canSelectProvider()` (documented as non-privileged); `expanded_storage`/`advanced_ai` were deliberately not added as separate flags (fully expressed by `storage_bytes`/`ai_messages` limits already).

## 6. Storage model

`storage_bytes` is a real, plan-scoped `plan_quotas` limit (Free 500 MB / Pro & Founding Pro 5 GB / Enterprise 50 GB), enforced server-side by `enforce_storage_quota()`, a `BEFORE INSERT` trigger on `documents` and `assets` — verified live to be present and enabled. Usage is computed on demand via `calculate_user_storage_usage()` (sum of `documents.file_size` + `assets.size_bytes`) rather than tracked incrementally, since storage is a running total, not a period-resetting counter. Client-side: `getStorageUsage()`/`useStorageUsage()` hook, `UsageIndicator` component, wired into the Settings billing card.

## 7. Collaboration model

**Collaboration is Pro-only**, exactly as directed. The single enforcement point is `invite_to_workspace` — gated on `has_feature(auth.uid(), 'collaboration')`, re-checked server-side regardless of what the client shows. Workspace creation and single-owner use remain available to every plan (Free keeps the full personal workspace). Client-side, `WorkspaceMemberRoster` now checks `useHasFeature('collaboration')` and shows an "Upgrade to Pro" prompt instead of the invite form for ineligible owners — a UX improvement only; the database is the real boundary.

## 8. Billing tables

`billing_customers` (user_id, provider, provider_customer_id, unique on both), `subscriptions` (user_id, plan_id, provider, provider_subscription_id, status, period bounds, cancel_at_period_end, last_event_at), `subscription_events` (provider, provider_event_id — the idempotency key, event_type, processing_status, raw_payload). RLS: own-row SELECT on the first two; zero client policies on `subscription_events` (matches the `beta_invites` precedent). No plan/quota data is duplicated into `subscriptions` — it explains the billing relationship; `user_plan_assignments` remains the sole entitlement-granting mechanism.

## 9. Payment provider — selected and why

**Not selected. This is the one remaining business decision**, per your own instruction not to blindly integrate Stripe and to build a provider-agnostic architecture if the decision can't be confidently finalized. Stripe does not offer direct Tanzania merchant accounts. Paddle/Lemon Squeezy (merchant-of-record, handles global tax/VAT, simplest integration) and Flutterwave/Pesapal/DPO/AzamPay (regional processors, mobile-money support, East-Africa-native) are the realistic candidates; each has different fee/settlement/seller-of-record tradeoffs that are a business decision, not an engineering one. The webhook Edge Function and `apply_subscription_event()` RPC are built to accept any provider's normalized event shape without redesign — wiring a real provider means writing one `normalizeProviderEvent()` function against that provider's actual webhook payload.

## 10. Webhook architecture

`supabase/functions/billing-webhook/index.ts`: verifies an HMAC-SHA256 signature (generic reference implementation — the exact header/algorithm must be confirmed against whichever provider is chosen) before touching anything else; fails closed with `501` if webhook secrets aren't configured (true today, in every environment); normalizes the payload; calls `apply_subscription_event()` with the service-role client. It is not deployed or wired to any real provider — no credentials exist. `supabase functions deploy billing-webhook --no-verify-jwt` is the deploy command noted in its own header (no Supabase JWT applies to a provider webhook call).

## 11. Subscription state machine

Implemented inside `apply_subscription_event()`: `active`/`past_due` → user assigned to the event's plan (deactivate-old/insert-new, same pattern `admin_change_user_plan` already uses); `cancelled`/`expired` → user assigned back to `free`. `cancel_at_period_end = true` while status is still `active` intentionally does not change the assignment — access continues until a later event actually flips status, which is where a grace-period policy would be implemented without redesign. Idempotency: unique `(provider, provider_event_id)`. Out-of-order protection: incoming event timestamp compared against `subscriptions.last_event_at` before applying.

## 12. Commercial UX delivered

- `/pricing` — Free/Pro/Founding Pro comparison, current-plan badge, "Checkout coming soon" (honest — no provider is live) instead of a fake payment flow.
- Settings → Billing card: current plan, subscription status badge, payment-failure banner (past_due), cancellation notice, storage usage bar.
- Upgrade CTA at the quota-exhaustion moment: `ChatPage`'s error banner shows "Upgrade to Pro" instead of "Retry" specifically for `quota_exceeded`.
- Upgrade CTA at the collaboration boundary: `WorkspaceMemberRoster` shows an upgrade prompt in place of the invite form for non-Pro owners.
- `UsageIndicator` — one reusable usage/limit bar component.

No custom card-entry UI, no invoice generation, no full billing dashboard, per your instructions.

## 13. Security model

- `apply_subscription_event()`: `EXECUTE` revoked from `public`/`anon`/`authenticated`, granted to `service_role` only — verified live via `has_function_privilege`. This is a structural (grant-level) guarantee, not an in-body check that a bug could weaken.
- `subscription_events` has zero client RLS policies.
- Storage quota enforced by a database trigger, not a client-side check.
- Collaboration gated inside `invite_to_workspace`, re-checked server-side on every call.
- Admin governance: unchanged. `admin_update_plan_quota`/`admin_change_user_plan` remain the manual-override path; the conflict rule is: **the most recent write wins** — a webhook-driven `apply_subscription_event()` and an admin RPC both write `user_plan_assignments` via the same deactivate-old/insert-new pattern, so whichever fires last is authoritative, exactly mirroring how `admin_change_user_plan` already treats itself as authoritative over the prior state. No separate "lock" was added — flagging this as a design detail worth revisiting if manual overrides need to survive a subsequent webhook.

## 14. Tests added

- `src/modules/plans/api/plans.test.ts` — `hasFeature` (fail-closed on RPC error) and `getStorageUsage`.
- `supabase/tests/founding_protection_test.sql` — the mandatory Founding Protection Test. **Executed live against production** (see §16): Pro's `ai_messages`/`storage_bytes` were changed, Founding Pro's were confirmed unchanged, Pro was restored exactly.
- `supabase/tests/billing_security_test.sql` — read-only grant/structure assertions (self-upgrade blocked for anon/authenticated, storage triggers enabled, collaboration gate present in `invite_to_workspace`). **Executed live against production**, passed.
- Full existing suite (2011 tests) re-run and passing — no regressions.

## 15. Verification results

- `tsc -b`: clean.
- `vitest run`: 255 files, 2011 tests, all passing.
- `oxlint`: 0 warnings, 0 errors (964 files).
- `vite build`: succeeds (pre-existing large-chunk warning, unrelated to this phase — dominated by pdf.js/docx/xlsx).

## 16. What was actually verified live vs. code-reviewed only

Executed for real against production and confirmed passing:
- Founding Protection Test (bounded, reverted — see the SQL file's own header for the exact before/after values).
- `apply_subscription_event` grants: `anon`=false, `authenticated`=false, `service_role`=true.
- `admin_update_plan_quota` grant: `authenticated`=true (expected — self-gated by `is_platform_admin()` inside the function body, same as every other `admin_*` RPC).
- Storage triggers present and enabled on `documents`/`assets`.
- `invite_to_workspace` contains the collaboration check.

**Verified by code review only, not executed live** (would require creating real `billing_customers`/`subscriptions`/`user_plan_assignments` rows against a real user, which is not safe to do against production without either a real signup or a paid Supabase branch):
- Duplicate webhook event does not duplicate subscription state.
- Duplicate event does not duplicate plan assignment.
- Out-of-order events cannot overwrite newer state.
- Cancelled subscription retains access until period end / eventually loses it on expiry.
- Invalid webhook signature rejected (also blocked by the complete absence of an edge-function test harness anywhere in this repo — none of the other 5 existing Edge Functions have tests either).

If you want these executed live rather than code-reviewed, the safe way is a temporary Supabase branch (`create_branch`) — this has a real cost that requires your confirmation before I'd spin one up, so I did not do it unprompted.

## 17. Exact files changed

Modified: `src/app/router.tsx`, `src/modules/ai/chat/hooks/useSendMessage.ts`, `src/modules/ai/chat/pages/ChatPage.tsx`, `src/modules/plans/api/plans.ts`, `src/modules/settings/pages/SettingsPage.tsx`, `src/modules/workspaces/components/WorkspaceMemberRoster.tsx`, `src/shared/types/database.ts`.

Added: `src/modules/billing/{api/billing.ts,components/BillingCard.tsx,components/UsageIndicator.tsx,hooks/useSubscription.ts,pages/PricingPage.tsx}`, `src/modules/plans/{api/plans.test.ts,hooks/useHasFeature.ts,hooks/useStorageUsage.ts}`, `supabase/functions/billing-webhook/index.ts`, `supabase/migrations/0044–0048*.sql`, `supabase/tests/{founding_protection_test.sql,billing_security_test.sql}`.

Nothing else changed — confirmed via `git status`/`git diff --stat` before committing.

## 18. Manual Supabase Dashboard actions required

None to reach this state — all 5 migrations are already applied live. To go further toward real commercial operation: set `BILLING_WEBHOOK_PROVIDER`, `BILLING_WEBHOOK_SECRET`, `BILLING_WEBHOOK_SIGNATURE_HEADER`, `BILLING_PRICE_PLAN_MAP` as Edge Function secrets once a provider is chosen, then `supabase functions deploy billing-webhook --no-verify-jwt`, then register that URL with the provider's webhook settings.

## 19. Remaining business decisions

1. **Payment provider selection** (§9) — the central open item.
2. **Grace-period policy** for `cancel_at_period_end` — the state machine supports whatever policy is chosen without redesign, but no policy is encoded yet.
3. **Exact Pro/Founding Pro pricing and grandfathering terms** — intentionally not represented anywhere in the schema (it never stored a price).
4. **Admin-override-vs-webhook conflict policy** (§13) — currently "most recent write wins"; if manual overrides need to survive a subsequent webhook, that needs an explicit design decision (e.g., a `locked` flag on `user_plan_assignments`).

## 20. Known limitations

- No real payment provider is wired — checkout, the customer portal, and live webhook delivery cannot be demonstrated end-to-end.
- Duplicate/out-of-order/cancellation webhook-path tests are code-reviewed, not live-executed (§16).
- `billing-webhook`'s signature verification is a generic reference implementation; must be adjusted to match whichever provider's actual scheme is chosen.
- No pricing/VAT/tax logic exists anywhere — deliberately out of scope until a provider is chosen (a merchant-of-record provider like Paddle would likely absorb this).

## 21. What genuine commercial readiness still requires (not claimed here)

Compiling and passing tests is not commercial readiness. Still needed before ARRIYIA can actually take money: an actual provider contract/merchant account, live webhook delivery tested against that provider's real events, a customer portal link, real pricing decided and entered somewhere, tax/VAT handling, and the write-path security tests in §16 executed for real (branch or staging). This report does not claim any of that is done.

## 22. Recommended Phase 5

1. Decide the payment provider (business decision, §9).
2. Wire `normalizeProviderEvent()` for that provider's real payload; deploy and register the webhook URL.
3. Run the full write-path test suite (duplicate/out-of-order/cancellation) against a Supabase branch or staging project.
4. Replace the `/pricing` "Checkout coming soon" button with the provider's real hosted checkout link.
5. Decide and implement the grace-period and admin-override-conflict policies (§19).
