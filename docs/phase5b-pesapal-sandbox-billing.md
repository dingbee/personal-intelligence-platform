# Phase 5B — Pesapal Sandbox Billing Integration: Final Report

Date: 2026-08-10
Repository: `dingbee/personal-intelligence-platform`
Branch: `phase5b-pesapal-sandbox-billing`, created from `phase4-commercial-architecture` @ `792a42d` (verified against the required baseline — see §0 below)

**Bottom line: ARRIYIA is NOT READY FOR REAL PAYMENTS.** No production credentials exist anywhere in this codebase, no production IPN is registered, and the code refuses to run against anything but `PESAPAL_ENV=sandbox` by construction (see §Security). Nothing in this phase processed, or could process, a real charge.

## 0. Repository / branch / baseline

- Verified before any work: repo `dingbee/personal-intelligence-platform`, branch `phase4-commercial-architecture`, HEAD `792a42d` (matches the required baseline exactly — both Phase 5A commits `8197a2c` and `792a42d` present), working tree clean.
- New branch `phase5b-pesapal-sandbox-billing` created from that HEAD; `phase4-commercial-architecture` was never modified directly. `dingbee/mtoni-river-lodge` was never touched.

## 1. A hard environment constraint discovered during this phase

This session's outbound network access is fully blocked at the infrastructure level — not just to Pesapal. A direct `curl` to `google.com` from this environment fails identically to a `curl` against `cybqa.pesapal.com` (`connection refused`, exit code unrelated to DNS/TLS). The only tools with any internet reach are `WebFetch`/`WebSearch`, which proxy through Anthropic's own infrastructure — and `WebFetch` itself is domain-blocked for `developer.pesapal.com` specifically.

Practical consequence: **no code in this session, including the deployed Edge Functions, could be exercised against Pesapal's actual sandbox host from within this session.** I could not retrieve `api3-demo-keys.txt`, could not obtain real sandbox consumer key/secret, and could not drive an actual `RequestToken` → `SubmitOrderRequest` → hosted-checkout → `IPN` round trip. This is disclosed here in full rather than glossed over, and it shapes every "verified" claim in §9 below.

What I *could* do: retrieve Pesapal's documented API 3.0 shape via `WebSearch` (which returned snippets sourced from `developer.pesapal.com` itself, plus corroborating detail from public open-source SDKs — `katorymnd/pesapal-php-sdk`, `CollinsMunene/pesapaljs-v3`, `django-pesapal`), and build/deploy/test everything on the ARRIYIA side of the integration for real against the live Supabase project.

## 2. Architecture

```
ARRIYIA Pricing
  -> pesapal-checkout Edge Function (server resolves plan/price; client sends only "start_pro_subscription")
  -> Pesapal RequestToken -> SubmitOrderRequest -> redirect_url
  -> browser redirected to Pesapal Sandbox hosted checkout
  -> Pesapal calls back to /billing/return (browser) and separately POSTs an IPN to pesapal-ipn (server)
  -> pesapal-ipn independently calls GetTransactionStatus (never trusts the IPN body's own claims)
  -> apply_subscription_event() [service-role only, unchanged from Phase 4]
  -> subscription_events (idempotency) -> subscriptions -> user_plan_assignments -> entitlement (unchanged)
```

The existing Phase 4 architecture was **not redesigned**. `apply_subscription_event()`, `subscriptions`, `subscription_events`, `billing_customers`, RLS, and the service-role-only grant are byte-for-byte what Phase 4 built — Pesapal is simply a new `provider = 'pesapal'` value flowing through the same pipe Phase 4's `billing-webhook` already established for any provider. One genuinely new table was added (see §4) for a problem that pipe cannot solve on its own: Pesapal's `SubmitOrderRequest` has no arbitrary metadata field the way Stripe's `metadata` does, so there is nowhere to attach "this checkout belongs to this ARRIYIA user, for this plan" before the first payment succeeds.

## 3. Pesapal integration

- **Sandbox base URL**: `https://cybqa.pesapal.com/pesapalv3` (production: `https://pay.pesapal.com/v3`) — fixed lookup table keyed by `PESAPAL_ENV`, never a free-form env var.
- **Auth**: `POST /api/Auth/RequestToken` with `{consumer_key, consumer_secret}` → bearer token (documented ~5 min expiry). Called fresh by both Edge Functions each time; no token caching, since neither is a high-frequency path.
- **Checkout**: `POST /api/Transactions/SubmitOrderRequest` — `id` (our merchant reference), `currency`, `amount`, `description`, `callback_url`, `notification_id` (our registered IPN id), `billing_address`, and `subscription_details: {start_date, end_date, frequency: "MONTHLY"}` (Pesapal's documented recurring-payment mechanism — see §5).
- **Status verification**: `GET /api/Transactions/GetTransactionStatus?orderTrackingId=...` — returns `status_code` (0=INVALID, 1=COMPLETED, 2=FAILED, 3=REVERSED per Pesapal's own documented mapping) and `merchant_reference`.
- **IPN registration**: `POST /api/URLSetup/RegisterIPN` — one-time setup, not built as a runtime Edge Function (deliberately out of scope per §32's scope discipline — it's an operational action, not a request-path concern). Documented as a manual step in §7 below.
- **IPN delivery**: Pesapal calls the registered URL with `OrderTrackingId`/`OrderMerchantReference`/`OrderNotificationType` (query params or JSON body depending on the registered notification type) and — per Pesapal's own documentation — **deliberately excludes payment status** from that call "for security reasons." The receiver must call `GetTransactionStatus` itself. `pesapal-ipn` does exactly that and responds with Pesapal's documented required ack shape (`{orderNotificationType, orderTrackingId, orderMerchantReference, status}`).

## 4. Files created / modified

**Migration**: `supabase/migrations/0050_pesapal_sandbox_billing.sql` — one new table, `pesapal_checkout_orders` (user_id, merchant_reference [unique], plan_code, amount_cents, currency, order_tracking_id, status). RLS: authenticated own-row SELECT only; zero client write policies (matches `subscription_events`' established pattern). Applied live and verified against production (project `uzshazetfkjkrdnxwjtl`).

**Edge Functions** (both deployed live and `ACTIVE` on the same project):
- `supabase/functions/pesapal-checkout/index.ts` (`verify_jwt: true` — an ARRIYIA user's own session JWT). Authenticates the caller, accepts only the literal string `"start_pro_subscription"` as input, resolves plan/price entirely server-side from `plans` (falling back to an explicit, clearly-commented `SANDBOX_TEST_AMOUNT_CENTS = 1000` placeholder only when `monthly_price_cents` is `NULL`, which it is today), mints a `pesapal_checkout_orders` row, calls Pesapal, and returns a `redirect_url`.
- `supabase/functions/pesapal-ipn/index.ts` (`verify_jwt: false` — Pesapal calls this with no Supabase JWT, exactly mirroring `billing-webhook`'s existing `--no-verify-jwt` precedent). Independently verifies via `GetTransactionStatus`, resolves the user/plan via `pesapal_checkout_orders` (never trusting the incoming payload directly), deduplicates on `${orderTrackingId}:${statusCode}`, and calls `apply_subscription_event()`.

**Client**: `src/modules/billing/api/billing.ts` (+`startProCheckout`, +`getCheckoutOrderByReference`), `src/modules/billing/hooks/useCheckoutOrderStatus.ts` (new, 2s-poll-until-terminal — same pattern as the pre-existing `useExtractionMetadata`), `src/modules/billing/pages/BillingReturnPage.tsx` (new — the "payment being confirmed" page), `src/modules/billing/pages/PricingPage.tsx` (real "Upgrade to Pro (sandbox)" button replacing "Checkout coming soon"), `src/modules/billing/components/BillingCard.tsx` (+renewal date, +"Billed via Pesapal (Sandbox)" line — explicitly the *billing* provider, never the AI provider), `src/app/router.tsx` (+`/billing/return`), `src/shared/types/database.ts` (+`PesapalCheckoutOrder` type + `Database` table entry).

**Tests**: `supabase/tests/pesapal_billing_security_test.sql` (new — see §8).

Nothing else changed — confirmed via `git status`/`git diff --stat` before committing.

## 5. Recurring-payment behavior (documented precisely, not guessed)

Pesapal's documentation states recurring is set up via `subscription_details` (`start_date`/`end_date`/`frequency`) on `SubmitOrderRequest`, and that **"the customer will be shown an option to opt into the recurring model on the Pesapal iframe during payment"** — i.e., recurring is Pesapal-hosted-checkout-driven and associated with card (Visa/Mastercard) payment, not a flag this code can force. `pesapal-checkout` sends `subscription_details` unconditionally (the documented mechanism to make recurring *available*), but whether it actually activates for a given sandbox transaction depends on the payment method the test shopper picks inside Pesapal's own iframe — something this codebase deliberately does not and cannot control, and did not fabricate support for. **Mobile-money recurring is not advertised anywhere in this codebase's UI or docs**, per the explicit instruction not to claim it without Pesapal confirming it.

**Genuine unresolved uncertainty, disclosed rather than guessed away**: Pesapal API 3.0 has no separate "create subscription" object/endpoint distinct from `SubmitOrderRequest` — nothing in the documentation I could retrieve confirms whether a recurring charge on cycle 2+ arrives under the *same* `OrderTrackingId` as the initial payment, or a new one. `pesapal-ipn` assumes the former (uses the original `order_tracking_id` as `provider_subscription_id`, so a same-ID renewal correctly upserts onto the existing `subscriptions` row via its `(provider, provider_subscription_id)` uniqueness constraint) — this is the best-supported reading given no separate subscription-object endpoint exists, but it is flagged here as an assumption this environment could not verify live, not a confirmed fact. If Pesapal in practice mints a new tracking ID per cycle, the fix is localized entirely to `pesapal-ipn`'s `p_provider_subscription_id` line.

## 6. Security model

- **Server-controlled commercial resolution**: `pesapal-checkout` reads only a fixed intent string from the client; plan and price are always resolved server-side from `plans`. No client-supplied `plan_id`, price, or currency is ever read.
- **Server-controlled webhook mapping**: `pesapal-ipn` resolves `user_id`/`plan_code` exclusively from `pesapal_checkout_orders`, a row this codebase itself created at checkout time — never from anything Pesapal's payload claims.
- **Independent status verification**: the IPN body is used only to know *which* transaction to look up (`OrderTrackingId`); the actual outcome always comes from a `GetTransactionStatus` call authenticated with ARRIYIA's own server-side credentials. Pesapal's IPN carries no signature at all (by their own design — no payment status is included in it "for security reasons"), so there is nothing to fake-sign; this verify-by-independent-lookup model is the actual authentication boundary, documented in the function's own header.
- **Service-role-only entitlement mutation**: `apply_subscription_event()` is unchanged from Phase 4 — `EXECUTE` revoked from `anon`/`authenticated`, granted to `service_role` only. Re-verified live this phase (not assumed unchanged).
- **RLS**: `pesapal_checkout_orders` — authenticated own-row SELECT only, zero write policies for any client role. Verified live, including that the policy's own `USING` clause is scoped to `auth.uid() = user_id` (not just "a policy exists").
- **No production activation possible by omission**: both Edge Functions hard-fail with `501` unless `PESAPAL_ENV=sandbox` is explicitly set, and `production` is explicitly rejected in the current deployment even if someone set that env var — a second, independent gate beyond "the secret just isn't configured yet."

### Environment variables (server-side only, never in React code, never `VITE_`-prefixed, never committed)

```
PESAPAL_ENV=sandbox
PESAPAL_CONSUMER_KEY=...
PESAPAL_CONSUMER_SECRET=...
PESAPAL_IPN_ID=...
PESAPAL_CALLBACK_URL=https://<your-app-origin>/billing/return
```

None of these are set in this Supabase project today — both functions correctly return `501 Pesapal checkout/IPN is not configured for this environment` until an operator sets them (see §7).

## 7. What an operator still needs to do before this is even sandbox-testable end-to-end

1. Retrieve real Pesapal Sandbox demo credentials from `https://developer.pesapal.com/api3-demo-keys.txt` (this session could not reach that URL — see §1).
2. Set `PESAPAL_ENV`, `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET` as Supabase Edge Function secrets.
3. Register the IPN URL once: `POST https://cybqa.pesapal.com/pesapalv3/api/URLSetup/RegisterIPN` with `{"url": "https://<project-ref>.supabase.co/functions/v1/pesapal-ipn", "ipn_notification_type": "POST"}`, authenticated with a bearer token from `RequestToken`. Take the returned `ipn_id` and set it as `PESAPAL_IPN_ID`.
4. Set `PESAPAL_CALLBACK_URL` to `<your app origin>/billing/return`.
5. From the app, click "Upgrade to Pro (sandbox)" on `/pricing` and complete a test transaction with Pesapal's documented sandbox test card/mobile-money credentials.

## 8. Tests

**Live, executed, self-cleaning** — `supabase/tests/pesapal_billing_security_test.sql`, run against production (project `uzshazetfkjkrdnxwjtl`) on 2026-08-10:

- **Part 1 (structural security)**: confirmed `authenticated` cannot INSERT/UPDATE `pesapal_checkout_orders`, `anon` cannot SELECT it, its SELECT policy is genuinely scoped to `auth.uid() = user_id` (not just present), and `apply_subscription_event` remains unreachable by `anon`/`authenticated` and reachable only by `service_role`. **PASSED.**
- **Part 2 (full state-machine lifecycle)**: wrapped in `begin; ... rollback;` — created a synthetic `auth.users` row (which required discovering and satisfying a `beta_invites` gate trigger live), drove it through `apply_subscription_event()` — the exact unmodified function `pesapal-ipn` calls — across: `FREE → PRO_ACTIVE` (successful payment), a redelivered duplicate event (`outcome = 'duplicate_ignored'`, no second mutation), `PRO_ACTIVE → PRO_PAST_DUE` (failed renewal charge, access **not** revoked), `PRO_PAST_DUE → PRO_ACTIVE` (successful retry), cancellation requested (`cancel_at_period_end = true` while `status` stays `'active'` — user **remains** Pro), and finally `PRO_CANCELLED_PENDING → FREE` at period end. **All transitions correct. PASSED.** Verified live afterward that zero rows from this test remain in `beta_invites`/`auth.users`/`subscriptions` — the rollback left production untouched.
- **Regression check**: re-ran the Founding Protection Test and the storage downgrade-safety test live post-changes — both still pass, confirming this phase introduced no regression in either guarantee.

**Mapped against the required test matrix (§26 of the directive)**:

| Requirement | Status |
|---|---|
| Authenticated user can initiate Pro checkout | Code-reviewed + deployed; not live-executed against Pesapal (§1) |
| Anonymous user cannot initiate checkout | Live-verified (`pesapal-checkout` requires an `Authorization` header, returns 401 without one) |
| Client cannot choose arbitrary plan/price | Structural — code reads only a fixed intent string; verified by source review, not a runtime attack simulation |
| FREE → PRO_ACTIVE | **Live-verified** (Part 2) |
| Duplicate event → one mutation | **Live-verified** (Part 2) |
| PRO_ACTIVE → PRO_PAST_DUE | **Live-verified** (Part 2) |
| PRO_PAST_DUE → PRO_ACTIVE | **Live-verified** (Part 2) |
| PRO_ACTIVE → PRO_CANCELLED_PENDING | **Live-verified** (Part 2) |
| PRO_CANCELLED_PENDING → FREE | **Live-verified** (Part 2) |
| Authenticated user cannot invoke subscription mutation directly | **Live-verified** (Part 1) |
| Plan/price/quota/provider-allocation/status tampering blocked | **Live-verified** (Part 1, grant-level) — provider allocation itself is Phase 5A's unchanged, unaffected mechanism |
| Founding Pro isolation preserved | **Live-verified** (re-ran Phase 4/5A's existing test, unaffected) |
| Free = 1 AI provider, Pro = multiple | Unaffected by this phase — Phase 5A's mechanism, not touched |
| Storage downgrade never deletes documents | **Live-verified** (re-ran Phase 4/5A's existing test, unaffected) |
| Free cannot use collaboration, Pro can | Unaffected by this phase — Phase 4's mechanism, not touched |

Full pre-existing regression suite: **254 files, 2011 tests, all passing** — zero regressions.

## 9. Verified live vs. code-tested only vs. unable to test — kept explicitly separate

**Live Sandbox Verified** (a real HTTP round trip against Pesapal's actual sandbox host): **none.** This environment has no outbound network path to `cybqa.pesapal.com` at all (§1) — not a Pesapal-specific restriction, a total absence of general internet egress from Bash/fetch in this session.

**Live-verified against the real Supabase project** (not Pesapal, but the ARRIYIA-side half of the integration, executed for real): the full subscription state machine (§8, Part 2), all structural security/RLS/grant checks (§8, Part 1), both Edge Functions deploying and passing Supabase's own validation as `ACTIVE` with the correct `verify_jwt` setting for each, the migration applying cleanly, and the pre-existing Founding Protection / storage downgrade-safety tests continuing to pass unregressed.

**Code-tested only** (written and reviewed against Pesapal's documented API shape, but never executed against Pesapal): `RequestToken`, `SubmitOrderRequest`, `GetTransactionStatus` calls inside both Edge Functions; the recurring-payment `subscription_details` payload; the IPN ack response shape.

**Unable to test — genuine Pesapal Sandbox / environment limitation, not a shortcut taken**: any real checkout, any real IPN delivery, IPN registration itself, retrieval of demo credentials, and therefore the exact wire-format Pesapal actually sends (my documented shapes come from Pesapal's own docs and public SDKs, not from an observed real response in this session).

## 10. Known Pesapal limitations / open questions for a human to resolve before production

- Whether renewal-cycle IPNs reuse the original `OrderTrackingId` (§5) — assumed, not confirmed.
- No documented merchant-initiated "cancel recurring subscription" API endpoint was found in what this session could retrieve — cancellation in production may require either a Pesapal support/dashboard action or the cardholder declining via their bank, not a self-serve API call. `apply_subscription_event()`'s cancellation state machine (cancel-requested → still Pro → period end → Free) works correctly regardless of *how* the cancel signal reaches it, but *what actually triggers that signal from Pesapal* for a merchant-initiated cancellation is unresolved.
- Grace-period/retry cadence for a failed recurring charge is Pesapal's own behavior, not something this codebase configures — undocumented in what was retrievable this session.
- Real Pro pricing remains undecided (unchanged from Phase 4/5A) — `plans.monthly_price_cents` is still `NULL`; the sandbox flow uses an explicitly-labeled `$10.00` placeholder that can never be mistaken for a real price (gated behind `PESAPAL_ENV=sandbox` only).

## 11. Production activation checklist (nothing here is checked off)

```
[ ] Pesapal production merchant credentials
[ ] Production IPN registration
[ ] Production callback URL
[ ] Production commercial prices confirmed
[ ] Monthly Pro price confirmed
[ ] Annual Pro price confirmed
[ ] Founding Pro terms confirmed
[ ] Refund policy confirmed
[ ] Cancellation policy confirmed
[ ] Payment failure policy confirmed
[ ] Tax/legal requirements reviewed
[ ] Billing emails configured
[ ] Production webhook tested
[ ] Production secrets configured
[ ] Final security review
[ ] Final end-to-end payment test
[ ] Controlled Founding Pro launch
[ ] General Pro launch
```

## 12. Unresolved business decisions

1. Real Pro pricing (monthly/annual, currency) — still not decided.
2. Founding Pro grandfathered commercial terms — still not decided.
3. Refund and cancellation policy — no merchant-facing policy exists yet; the technical cancellation state machine is ready for whatever policy is chosen.
4. Whether Pesapal remains the sole/primary payment provider or a second regional processor is added later — out of scope for this phase by design (§32).
