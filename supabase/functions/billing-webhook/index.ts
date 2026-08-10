// Supabase Edge Function (Deno). Phase 4 Commercial Architecture — the
// single entry point for payment-provider webhooks, and the only thing in
// this codebase authorized to grant paid entitlement.
//
// ARCHITECTURAL POSITION (do not weaken this):
//
//   payment provider -> [THIS FUNCTION] -> apply_subscription_event() RPC
//     -> subscription_events (idempotency log) -> subscriptions
//     -> user_plan_assignments (existing, unchanged) -> plans/plan_quotas
//     (existing, unchanged) -> entitlement resolution (existing, unchanged)
//
// This function never touches user_plan_assignments or plans/plan_quotas
// directly — it only ever calls apply_subscription_event(), which is
// granted EXECUTE to service_role alone (revoked from anon/authenticated
// in 0047). That grant, not any check in this file, is the actual reason
// a client can never self-upgrade: even a bug here that skipped every
// check below still could not reach that RPC without the service-role key,
// which only exists in this function's environment.
//
// PROVIDER STATUS — deliberately NOT wired to a real payment provider.
// ARRIYIA operates from Tanzania, where Stripe does not offer direct
// merchant accounts; Paddle/Lemon Squeezy (merchant-of-record) and
// Flutterwave/Pesapal/DPO/AzamPay (regional processors with mobile-money
// support) are the realistic candidates, but which one ARRIYIA actually
// contracts with — and therefore that provider's real webhook payload
// shape, event names, and signature scheme — is a business decision this
// migration does not make. What's built here is the provider-agnostic
// pipeline every one of those options needs identically: verify signature
// before doing anything else, deduplicate by provider event id, normalize
// into ARRIYIA's own shape, apply through the one authorized RPC, respond
// fast. Wiring a real provider means writing ONE function —
// `normalizeProviderEvent` below — that turns that provider's actual
// webhook body into `NormalizedBillingEvent`; nothing else in this file
// changes.
//
// SIGNATURE VERIFICATION — `verifyHmacSignature` below is a generic
// HMAC-SHA256-of-raw-body reference implementation (the shape used by
// Flutterwave's `verif-hash`-style secret check and Paddle Classic's
// HMAC scheme), gated entirely behind `BILLING_WEBHOOK_SECRET` /
// `BILLING_WEBHOOK_SIGNATURE_HEADER`. If those secrets are unset, this
// function refuses every request with 501 rather than silently accepting
// unsigned webhooks — there is no code path where a missing secret
// results in signature verification being skipped. The exact header name
// and algorithm MUST be confirmed against whichever provider is actually
// selected (some providers use a different hash, include a timestamp in
// the signed payload, or send the raw shared secret instead of an HMAC)
// before this function is pointed at production traffic.
//
// USER RESOLUTION — a webhook has no ARRIYIA session, so it cannot
// identify which account a subscription belongs to except through data
// ARRIYIA itself attached at checkout time. The convention this pipeline
// expects is `metadata.arriyia_user_id` on the provider's customer/
// subscription object, which the (not-yet-built) checkout-session
// creation code is responsible for setting to `auth.uid()` when it starts
// the provider's hosted checkout. Whichever provider is chosen, the
// integration is not complete until checkout creation sets this.
//
// Deploy: supabase functions deploy billing-webhook --no-verify-jwt
// (--no-verify-jwt because the caller is the payment provider, not an
// ARRIYIA user — there is no Supabase-issued JWT to verify; this
// function's own signature check is the authentication boundary instead.)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

/** Constant-time string compare — a signature check that short-circuits on the first differing byte leaks timing information an attacker can use to forge a valid signature one byte at a time. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function verifyHmacSignature(rawBody: string, providedSignatureHex: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expectedHex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return timingSafeEqual(expectedHex, providedSignatureHex.toLowerCase())
}

interface NormalizedBillingEvent {
  providerEventId: string
  eventType: string
  userId: string
  providerCustomerId: string
  providerSubscriptionId: string
  planCode: string
  status: 'active' | 'past_due' | 'cancelled' | 'expired'
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  eventTimestamp: string
}

/**
 * Placeholder normalized envelope pending real provider selection — see
 * this file's header comment. Wiring a real provider replaces the body of
 * this one function with that provider's actual webhook JSON shape; every
 * other function in this file is provider-agnostic and does not change.
 * `priceIdToPlanCode` is the server-side translation from "whatever the
 * provider calls this price/product" to an ARRIYIA plan code — the
 * payload's own claimed plan (if any) is never trusted directly, exactly
 * per the "provider never directly determines feature access" requirement.
 */
function normalizeProviderEvent(rawPayload: Record<string, unknown>, priceIdToPlanCode: Record<string, string>): NormalizedBillingEvent | { error: string } {
  const data = rawPayload.data as Record<string, unknown> | undefined
  const metadata = data?.metadata as Record<string, unknown> | undefined

  const providerEventId = typeof rawPayload.id === 'string' ? rawPayload.id : undefined
  const eventType = typeof rawPayload.type === 'string' ? rawPayload.type : undefined
  const userId = typeof metadata?.arriyia_user_id === 'string' ? metadata.arriyia_user_id : undefined
  const providerCustomerId = typeof data?.customer_id === 'string' ? data.customer_id : undefined
  const providerSubscriptionId = typeof data?.subscription_id === 'string' ? data.subscription_id : undefined
  const priceId = typeof data?.price_id === 'string' ? data.price_id : undefined
  const status = typeof data?.status === 'string' ? data.status : undefined
  const eventTimestamp = typeof rawPayload.occurred_at === 'string' ? rawPayload.occurred_at : new Date().toISOString()

  if (!providerEventId || !eventType || !userId || !providerCustomerId || !providerSubscriptionId || !priceId || !status) {
    return { error: 'Webhook payload is missing one or more required fields (id, type, data.metadata.arriyia_user_id, data.customer_id, data.subscription_id, data.price_id, data.status)' }
  }

  if (!['active', 'past_due', 'cancelled', 'expired'].includes(status)) {
    return { error: `Unrecognized subscription status: ${status}` }
  }

  const planCode = priceIdToPlanCode[priceId]
  if (!planCode) {
    return { error: `No plan mapping configured for price id: ${priceId}` }
  }

  return {
    providerEventId,
    eventType,
    userId,
    providerCustomerId,
    providerSubscriptionId,
    planCode,
    status: status as NormalizedBillingEvent['status'],
    currentPeriodStart: typeof data?.current_period_start === 'string' ? data.current_period_start : null,
    currentPeriodEnd: typeof data?.current_period_end === 'string' ? data.current_period_end : null,
    cancelAtPeriodEnd: data?.cancel_at_period_end === true,
    eventTimestamp,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const webhookSecret = Deno.env.get('BILLING_WEBHOOK_SECRET')
  const signatureHeaderName = Deno.env.get('BILLING_WEBHOOK_SIGNATURE_HEADER') ?? 'x-webhook-signature'
  const providerName = Deno.env.get('BILLING_WEBHOOK_PROVIDER')
  const priceMapJson = Deno.env.get('BILLING_PRICE_PLAN_MAP')

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret || !providerName) {
    // Fails closed: no payment provider is configured for this deployment
    // (expected in every environment right now — see this file's header).
    // Never falls through to "skip verification and accept it anyway."
    return jsonResponse({ error: 'Billing webhook is not configured for this environment' }, 501)
  }

  const rawBody = await req.text()
  const providedSignature = req.headers.get(signatureHeaderName)
  if (!providedSignature) return jsonResponse({ error: 'Missing signature header' }, 401)

  const signatureValid = await verifyHmacSignature(rawBody, providedSignature, webhookSecret)
  if (!signatureValid) return jsonResponse({ error: 'Invalid signature' }, 401)

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ error: 'Malformed JSON payload' }, 400)
  }

  let priceIdToPlanCode: Record<string, string> = {}
  if (priceMapJson) {
    try {
      priceIdToPlanCode = JSON.parse(priceMapJson)
    } catch {
      return jsonResponse({ error: 'BILLING_PRICE_PLAN_MAP is not valid JSON' }, 500)
    }
  }

  const normalized = normalizeProviderEvent(payload, priceIdToPlanCode)
  if ('error' in normalized) return jsonResponse({ error: normalized.error }, 400)

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  // apply_subscription_event() is granted to service_role only — this is
  // the only place in the codebase that can reach it, and the only place
  // that ever should. Idempotency (duplicate provider_event_id) and
  // out-of-order-event protection both live inside the RPC itself, not
  // here, so this function stays a thin, auditable pass-through.
  const { data, error } = await serviceClient.rpc('apply_subscription_event', {
    p_provider: providerName,
    p_provider_event_id: normalized.providerEventId,
    p_event_type: normalized.eventType,
    p_user_id: normalized.userId,
    p_provider_customer_id: normalized.providerCustomerId,
    p_provider_subscription_id: normalized.providerSubscriptionId,
    p_plan_code: normalized.planCode,
    p_status: normalized.status,
    p_current_period_start: normalized.currentPeriodStart,
    p_current_period_end: normalized.currentPeriodEnd,
    p_cancel_at_period_end: normalized.cancelAtPeriodEnd,
    p_event_timestamp: normalized.eventTimestamp,
    p_raw_payload: payload,
  })

  if (error) {
    console.error('billing-webhook: apply_subscription_event failed:', error)
    return jsonResponse({ error: 'Failed to apply subscription event' }, 500)
  }

  return jsonResponse(data, 200)
})
