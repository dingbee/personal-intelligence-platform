-- Phase 5B — Pesapal Sandbox Billing Integration.
--
-- The Phase 4 billing schema (billing_customers/subscriptions/
-- subscription_events/apply_subscription_event) is entirely provider-
-- neutral already — `provider` is a plain text column, so Pesapal fits
-- with zero changes to any of those tables or to apply_subscription_event
-- itself. This migration adds exactly one new table, for a problem those
-- tables cannot solve: Pesapal's SubmitOrderRequest has no arbitrary
-- metadata field (unlike Stripe's `metadata`), so there is nowhere to
-- attach "this checkout attempt belongs to this ARRIYIA user, for this
-- plan, at this server-resolved price" before the first payment succeeds
-- and a subscriptions row can exist. `pesapal_checkout_orders` is that
-- mapping, minted entirely server-side at checkout-initiation time by the
-- pesapal-checkout Edge Function, and is the *only* thing the pesapal-ipn
-- Edge Function trusts to resolve OrderMerchantReference back to a user_id
-- and plan_code — Pesapal's own webhook payload is never trusted for
-- either value (see pesapal-ipn/index.ts's header comment for the full
-- verification chain). This is the concrete implementation of "the
-- webhook must never accept plan_id from an untrusted external payload."
--
-- Also doubles as the data source for the "payment being confirmed" UX
-- state (BillingReturnPage) — a user's own checkout orders are readable
-- by that user only, so the return page can poll "did my payment land
-- yet" without needing any Pesapal-specific knowledge client-side.

create table public.pesapal_checkout_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The `id` field ARRIYIA sends Pesapal in SubmitOrderRequest, and the
  -- exact string Pesapal echoes back as OrderMerchantReference in both the
  -- callback redirect and the IPN call. Minted by pesapal-checkout, never
  -- client-supplied.
  merchant_reference text not null unique,
  -- Always 'pro' today (the only self-serve paid plan) — resolved
  -- server-side from the fixed 'start_pro_subscription' intent the client
  -- sends, never from any client- or Pesapal-supplied plan identifier.
  plan_code text not null,
  amount_cents integer not null,
  currency text not null,
  -- Populated once Pesapal's SubmitOrderRequest response returns it;
  -- unique because Pesapal mints exactly one per submitted order.
  order_tracking_id text unique,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pesapal_checkout_orders_user_id_idx on public.pesapal_checkout_orders (user_id);
create index pesapal_checkout_orders_order_tracking_id_idx on public.pesapal_checkout_orders (order_tracking_id);

alter table public.pesapal_checkout_orders enable row level security;

create policy "Users can view their own checkout orders"
  on public.pesapal_checkout_orders for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Zero client write policies, matching subscription_events' established
-- pattern: the only writers are pesapal-checkout (creates the row after
-- authenticating the caller) and pesapal-ipn (updates status/
-- order_tracking_id after independently verifying with Pesapal) — both
-- via their service-role client, never the caller's own session.
revoke insert, update, delete, truncate on public.pesapal_checkout_orders from anon, authenticated;
revoke select, insert, update, delete, truncate on public.pesapal_checkout_orders from anon;
