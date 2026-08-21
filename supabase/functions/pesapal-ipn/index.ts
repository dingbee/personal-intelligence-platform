// Supabase Edge Function (Deno). Phase 5B Pesapal Sandbox Billing — the
// IPN (Instant Payment Notification) handler. This is the ONLY thing in
// this codebase authorized to grant paid entitlement via Pesapal, and it
// follows the exact same architectural position billing-webhook already
// established in Phase 4:
//
//   Pesapal IPN -> [THIS FUNCTION] -> apply_subscription_event() RPC
//     -> subscription_events (idempotency log) -> subscriptions
//     -> user_plan_assignments (existing, unchanged) -> plans/plan_quotas
//     (existing, unchanged) -> entitlement resolution (existing, unchanged)
//
// VERIFICATION MODEL — different from billing-webhook's generic HMAC
// scheme, because Pesapal's IPN has no signature at all. Per Pesapal's own
// documented flow, the IPN/callback parameters (OrderTrackingId,
// OrderMerchantReference, OrderNotificationType) deliberately do NOT
// include the payment status "for security reasons" — so there is nothing
// to fake-sign in the first place. Authenticity instead comes from asking
// Pesapal directly: this function takes the OrderTrackingId from the
// incoming call, obtains ITS OWN bearer token via consumer_key/secret
// (never anything from the request), and calls GetTransactionStatus.
// Whatever that authenticated call returns is the only thing ever treated
// as the payment outcome — the incoming notification body/query string is
// used only to know *which* transaction to look up, never *what happened*
// to it. This is Step 4 of the mandated IPN flow (see
// docs/phase5b-pesapal-sandbox-billing.md's Security Model section).
//
// PLAN MAPPING — OrderMerchantReference is matched against
// `pesapal_checkout_orders`, a row this codebase itself created at
// checkout-initiation time (pesapal-checkout/index.ts). The plan_code and
// user_id used below always come from THAT row, never parsed out of the
// incoming payload or trusted from anything Pesapal echoes back. An
// attacker who calls this endpoint with a fabricated merchant reference
// simply finds no matching row and the call is a no-op.
//
// IDEMPOTENCY — provider_event_id is `${orderTrackingId}:${statusCode}`.
// A redelivered notification for the same transaction, still in the same
// status, collides on this and apply_subscription_event() returns
// 'duplicate_ignored' without mutating anything (verified live — see
// docs). A genuine status transition (e.g. PENDING -> COMPLETED, or a
// later REVERSED) is a different key and is correctly applied.
//
// Deploy: supabase functions deploy pesapal-ipn --no-verify-jwt
// (Pesapal calls this, not an ARRIYIA user — there is no Supabase JWT to
// verify; independent GetTransactionStatus verification is the
// authentication boundary instead, exactly as billing-webhook's header
// documents for its own HMAC check.)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const PESAPAL_BASE_URL: Record<string, string> = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3',
  production: 'https://pay.pesapal.com/v3',
}

// Pesapal API 3.0's documented status_code values
// (developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/gettransactionstatus):
// 0=INVALID, 1=COMPLETED, 2=FAILED, 3=REVERSED.
type PesapalStatusCode = 0 | 1 | 2 | 3

interface GetTransactionStatusResponse {
  payment_status_description?: string
  status_code?: PesapalStatusCode
  merchant_reference?: string
  order_tracking_id?: string
  amount?: number
  currency?: string
  error?: unknown
}

/**
 * Pesapal's documented required response shape for an IPN call
 * (orderNotificationType/orderTrackingId/orderMerchantReference/status).
 * `status: 200` tells Pesapal the notification was accepted; a non-200
 * value here signals Pesapal to retry delivery.
 */
function ipnAckResponse(params: { orderTrackingId: string; orderMerchantReference: string; notificationType: string; ackStatus: 200 | 500 }): Response {
  return new Response(
    JSON.stringify({
      orderNotificationType: params.notificationType,
      orderTrackingId: params.orderTrackingId,
      orderMerchantReference: params.orderMerchantReference,
      status: params.ackStatus,
    }),
    { status: 200, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } },
  )
}

async function requestPesapalToken(baseUrl: string, consumerKey: string, consumerSecret: string): Promise<{ token: string } | { error: string }> {
  const res = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  })
  const body = (await res.json().catch(() => null)) as { token?: string; message?: string } | null
  if (!res.ok || !body?.token) return { error: `RequestToken failed (${res.status}): ${body?.message ?? 'no token'}` }
  return { token: body.token }
}

async function getTransactionStatus(baseUrl: string, token: string, orderTrackingId: string): Promise<GetTransactionStatusResponse | { error: string }> {
  const res = await fetch(`${baseUrl}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  })
  const body = (await res.json().catch(() => null)) as GetTransactionStatusResponse | null
  if (!res.ok || !body) return { error: `GetTransactionStatus failed (${res.status})` }
  return body
}

/** ARRIYIA's own translation of Pesapal's 4 status codes into the subscription statuses apply_subscription_event() understands. isRenewal distinguishes "first payment never granted access" from "a recurring charge on an already-active subscription failed/succeeded." */
function normalizeStatus(statusCode: PesapalStatusCode, isRenewal: boolean): { status: 'active' | 'past_due' | 'cancelled'; shouldApply: boolean } {
  if (statusCode === 1) return { status: 'active', shouldApply: true }
  if (statusCode === 3) return { status: 'cancelled', shouldApply: true } // reversal/chargeback — access ends immediately, not at period end
  if (statusCode === 2) return { status: 'past_due', shouldApply: isRenewal } // a failed FIRST payment never granted access — nothing to apply
  return { status: 'past_due', shouldApply: false } // 0 = INVALID — not a real outcome, record for audit only
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'GET' && req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const pesapalEnv = Deno.env.get('PESAPAL_ENV')
  const consumerKey = Deno.env.get('PESAPAL_CONSUMER_KEY')
  const consumerSecret = Deno.env.get('PESAPAL_CONSUMER_SECRET')

  if (!supabaseUrl || !serviceRoleKey || !pesapalEnv || !consumerKey || !consumerSecret) {
    // Fails closed: matches billing-webhook's 501 pattern exactly — no
    // path where missing configuration results in silently accepting (or
    // worse, silently applying) an unverifiable notification.
    return new Response(JSON.stringify({ error: 'Pesapal IPN is not configured for this environment' }), {
      status: 501,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    })
  }
  if (pesapalEnv !== 'sandbox') {
    return new Response(JSON.stringify({ error: 'Only PESAPAL_ENV=sandbox is supported by this deployment of pesapal-ipn' }), {
      status: 501,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    })
  }
  const baseUrl = PESAPAL_BASE_URL[pesapalEnv]

  // Pesapal sends OrderTrackingId/OrderMerchantReference/OrderNotificationType
  // either as query params (GET, or POST with query string) or as a JSON
  // body — this reads both defensively since the exact shape depends on
  // the ipn_notification_type chosen at RegisterIPN time.
  const url = new URL(req.url)
  let orderTrackingId = url.searchParams.get('OrderTrackingId') ?? url.searchParams.get('orderTrackingId')
  let orderMerchantReference = url.searchParams.get('OrderMerchantReference') ?? url.searchParams.get('orderMerchantReference')
  let notificationType = url.searchParams.get('OrderNotificationType') ?? url.searchParams.get('orderNotificationType') ?? 'IPNCHANGE'

  if (!orderTrackingId && req.method === 'POST') {
    try {
      const body = (await req.json()) as Record<string, unknown>
      orderTrackingId = typeof body.OrderTrackingId === 'string' ? body.OrderTrackingId : (typeof body.orderTrackingId === 'string' ? body.orderTrackingId : null)
      orderMerchantReference = typeof body.OrderMerchantReference === 'string' ? body.OrderMerchantReference : (typeof body.orderMerchantReference === 'string' ? body.orderMerchantReference : null)
      notificationType = typeof body.OrderNotificationType === 'string' ? body.OrderNotificationType : notificationType
    } catch {
      // no JSON body — fall through with whatever query params yielded
    }
  }

  if (!orderTrackingId) {
    return ipnAckResponse({ orderTrackingId: '', orderMerchantReference: orderMerchantReference ?? '', notificationType, ackStatus: 500 })
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  // Step 4 (mandatory): independently verify with Pesapal — never trust
  // the notification's own claim of status, because it makes none.
  const tokenResult = await requestPesapalToken(baseUrl, consumerKey, consumerSecret)
  if ('error' in tokenResult) {
    console.error('pesapal-ipn:', tokenResult.error)
    return ipnAckResponse({ orderTrackingId, orderMerchantReference: orderMerchantReference ?? '', notificationType, ackStatus: 500 })
  }

  const statusResult = await getTransactionStatus(baseUrl, tokenResult.token, orderTrackingId)
  if ('error' in statusResult || statusResult.status_code === undefined) {
    console.error('pesapal-ipn: GetTransactionStatus failed for', orderTrackingId)
    return ipnAckResponse({ orderTrackingId, orderMerchantReference: orderMerchantReference ?? '', notificationType, ackStatus: 500 })
  }

  // Resolve the merchant reference from Pesapal's OWN authoritative
  // response (statusResult.merchant_reference), not from the untrusted
  // incoming call — falls back to the incoming value only if Pesapal's
  // response omits it, which the lookup below still can't be fooled by
  // since it only matches a row this codebase itself created.
  const merchantReference = statusResult.merchant_reference ?? orderMerchantReference
  if (!merchantReference) {
    return ipnAckResponse({ orderTrackingId, orderMerchantReference: '', notificationType, ackStatus: 500 })
  }

  const { data: order } = await serviceClient
    .from('pesapal_checkout_orders')
    .select('user_id, plan_code, order_tracking_id, status')
    .or(`merchant_reference.eq.${merchantReference},order_tracking_id.eq.${orderTrackingId}`)
    .maybeSingle()

  if (!order) {
    // No server-controlled mapping for this reference — cannot resolve a
    // user or plan. Nothing to apply; acknowledge so Pesapal stops
    // retrying a call we will never be able to process.
    console.error('pesapal-ipn: no matching checkout order for merchant_reference', merchantReference)
    return ipnAckResponse({ orderTrackingId, orderMerchantReference: merchantReference, notificationType, ackStatus: 200 })
  }

  const statusCode = statusResult.status_code
  // A "renewal" is any transaction status arriving after this checkout
  // order already recorded a completed payment once — the first payment
  // is what actually grants access, so a FAILED first attempt must never
  // touch entitlement (there is nothing to downgrade from).
  const isRenewal = order.status === 'completed'
  const { status: normalizedStatus, shouldApply } = normalizeStatus(statusCode, isRenewal)

  await serviceClient
    .from('pesapal_checkout_orders')
    .update({ status: statusCode === 1 ? 'completed' : statusCode === 2 && !isRenewal ? 'failed' : order.status, updated_at: new Date().toISOString() })
    .eq('merchant_reference', merchantReference)

  if (!shouldApply) {
    return ipnAckResponse({ orderTrackingId, orderMerchantReference: merchantReference, notificationType, ackStatus: 200 })
  }

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)

  const { error: applyError } = await serviceClient.rpc('apply_subscription_event', {
    p_provider: 'pesapal',
    // Idempotency key: same transaction + same status = the same event,
    // redelivered. A later status change for the same transaction (e.g.
    // a subsequent REVERSED after an earlier COMPLETED) is a distinct key
    // and is correctly applied as a new event.
    p_provider_event_id: `${orderTrackingId}:${statusCode}`,
    p_event_type: `pesapal.transaction.status_${statusCode}`,
    p_user_id: order.user_id,
    // Pesapal's e-commerce API 3.0 has no persistent "customer" object —
    // the ARRIYIA user_id is the only stable identifier available here.
    p_provider_customer_id: order.user_id,
    // See this file's header re: provider_subscription_id — Pesapal API
    // 3.0 has no separate "create subscription" endpoint distinct from
    // SubmitOrderRequest, so the original order_tracking_id is used as
    // the subscription's stable identifier. Documented as an assumption
    // this environment could not verify live (no network access to
    // Pesapal's sandbox) — see docs/phase5b-pesapal-sandbox-billing.md's
    // "Known Pesapal Limitations" section.
    p_provider_subscription_id: order.order_tracking_id ?? orderTrackingId,
    p_plan_code: order.plan_code,
    p_status: normalizedStatus,
    p_current_period_start: normalizedStatus === 'active' ? now.toISOString() : null,
    p_current_period_end: normalizedStatus === 'active' ? periodEnd.toISOString() : null,
    p_cancel_at_period_end: false,
    p_event_timestamp: now.toISOString(),
    p_raw_payload: { ipn: { orderTrackingId, orderMerchantReference: merchantReference, notificationType }, transactionStatus: statusResult },
  })

  if (applyError) {
    console.error('pesapal-ipn: apply_subscription_event failed:', applyError)
    // #21 Phase 5 — this is exactly the "billing inconsistency" the
    // unified System Health centre exists to surface: a Pesapal
    // notification that verified successfully but couldn't be applied
    // (previously console.error-only, per the observability audit that
    // found billing failure tracking partial/inconsistent). Awaited
    // (unlike a true fire-and-forget) because Edge Functions don't
    // guarantee unawaited work completes after the response is sent;
    // wrapped in try/catch so a reporting failure never changes Pesapal's
    // ack, since Pesapal retries on a 500 regardless.
    try {
      await serviceClient.rpc('report_system_health_event', {
        p_severity: 'error',
        p_category: 'billing',
        p_operation: 'apply_subscription_event',
        p_message: applyError.message,
        p_error_code: applyError.code ?? null,
        p_user_id: order.user_id,
        p_provider: 'pesapal',
        p_metadata: { order_tracking_id: orderTrackingId, merchant_reference: merchantReference, plan_code: order.plan_code, status_code: statusCode },
      })
    } catch (reportErr) {
      console.error('pesapal-ipn: failed to report system_health_event:', reportErr)
    }
    return ipnAckResponse({ orderTrackingId, orderMerchantReference: merchantReference, notificationType, ackStatus: 500 })
  }

  return ipnAckResponse({ orderTrackingId, orderMerchantReference: merchantReference, notificationType, ackStatus: 200 })
})
