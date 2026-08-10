// Supabase Edge Function (Deno). Phase 5B Pesapal Sandbox Billing —
// server-side checkout initiation. This is the ONLY thing the client is
// allowed to trigger toward Pesapal, and it accepts nothing from the
// client except a fixed intent string ("start_pro_subscription") — no
// plan_id, no price, no currency, no arbitrary amount. Every commercial
// fact (which plan, what it costs) is resolved here, server-side, from
// `plans` — a client sending a forged body cannot change what gets
// charged or what plan gets requested.
//
// SANDBOX ONLY. Refuses to run unless PESAPAL_ENV=sandbox. There is no
// code path in this function that can reach Pesapal's production host —
// PESAPAL_BASE_URL is derived from PESAPAL_ENV via a fixed lookup table,
// never from a client- or env-supplied URL string.
//
// Position in the architecture (see docs/phase5b-pesapal-sandbox-billing.md):
//
//   ARRIYIA Pricing -> [THIS FUNCTION] -> Pesapal Sandbox hosted checkout
//     -> customer pays -> Pesapal calls back / sends IPN to pesapal-ipn
//     -> pesapal-ipn independently verifies with Pesapal -> apply_subscription_event()
//     -> subscriptions -> user_plan_assignments -> entitlement (unchanged)
//
// This function never grants entitlement itself — it only ever creates a
// `pesapal_checkout_orders` row (the server-controlled mapping the IPN
// handler later trusts) and asks Pesapal for a redirect URL. No write to
// `subscriptions`/`user_plan_assignments` happens here or anywhere except
// inside `apply_subscription_event()`, unchanged from Phase 4.
//
// Deploy: supabase functions deploy pesapal-checkout
// Secrets required: PESAPAL_ENV=sandbox, PESAPAL_CONSUMER_KEY,
//   PESAPAL_CONSUMER_SECRET, PESAPAL_IPN_ID (from a one-time RegisterIPN
//   call — see docs), PESAPAL_CALLBACK_URL (ARRIYIA's own
//   https://<site>/billing/return page).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Pesapal API 3.0 base URLs, straight from the official docs
// (developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/authentication).
// Fixed lookup, never a free-form env var, so PESAPAL_ENV can only ever
// select between these two known hosts.
const PESAPAL_BASE_URL: Record<string, string> = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3',
  production: 'https://pay.pesapal.com/v3',
}

// Sandbox-only placeholder amount — no real Pro price has been decided
// (Phase 5A left plans.monthly_price_cents NULL for exactly this reason;
// see docs/phase4-commercial-architecture.md §19 and
// docs/phase5a-commercial-control.md's "Remaining provider-dependent
// work"). This constant exists solely to exercise the sandbox checkout
// flow end-to-end and is NEVER used unless PESAPAL_ENV=sandbox — see the
// hard guard in the handler below. It must never be read as ARRIYIA's
// intended production price.
const SANDBOX_TEST_AMOUNT_CENTS = 1000 // sandbox test value only — not a real price
const SANDBOX_TEST_CURRENCY = 'USD'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

interface PesapalTokenResponse {
  token?: string
  expiryDate?: string
  error?: unknown
  status?: string
  message?: string
}

async function requestPesapalToken(baseUrl: string, consumerKey: string, consumerSecret: string): Promise<{ token: string } | { error: string }> {
  const res = await fetch(`${baseUrl}/api/Auth/RequestToken`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  })
  const body = (await res.json().catch(() => null)) as PesapalTokenResponse | null
  if (!res.ok || !body?.token) {
    return { error: `Pesapal RequestToken failed (${res.status}): ${body?.message ?? 'no token in response'}` }
  }
  return { token: body.token }
}

// DD-MM-YYYY, the date format Pesapal's own recurring-payments example
// uses (developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/recurringpayments).
function formatPesapalDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${dd}-${mm}-${yyyy}`
}

interface SubmitOrderResponse {
  order_tracking_id?: string
  merchant_reference?: string
  redirect_url?: string
  error?: unknown
  status?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const pesapalEnv = Deno.env.get('PESAPAL_ENV')
  const consumerKey = Deno.env.get('PESAPAL_CONSUMER_KEY')
  const consumerSecret = Deno.env.get('PESAPAL_CONSUMER_SECRET')
  const ipnId = Deno.env.get('PESAPAL_IPN_ID')
  const callbackUrl = Deno.env.get('PESAPAL_CALLBACK_URL')

  // Fails closed exactly like billing-webhook's existing 501 pattern: no
  // silent fallback to "skip Pesapal and pretend it worked." This is also
  // the hard boundary that keeps production activation impossible until
  // someone deliberately sets PESAPAL_ENV=production AND swaps every
  // other secret for live ones (§28/§29 of the Phase 5B directive).
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !pesapalEnv || !consumerKey || !consumerSecret || !ipnId || !callbackUrl) {
    return jsonResponse({ error: 'Pesapal checkout is not configured for this environment' }, 501)
  }
  if (pesapalEnv !== 'sandbox' && pesapalEnv !== 'production') {
    return jsonResponse({ error: 'PESAPAL_ENV must be "sandbox" or "production"' }, 501)
  }
  // Phase 5B builds sandbox only — see this file's header and
  // docs/phase5b-pesapal-sandbox-billing.md §"No Production Activation".
  if (pesapalEnv !== 'sandbox') {
    return jsonResponse({ error: 'Only PESAPAL_ENV=sandbox is supported by this deployment of pesapal-checkout' }, 501)
  }
  const baseUrl = PESAPAL_BASE_URL[pesapalEnv]

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  const intent = (body as { intent?: unknown } | null)?.intent
  // The ONLY client input this function accepts. Anything else in the
  // body (a plan_id, a price, a currency) is simply never read.
  if (intent !== 'start_pro_subscription') {
    return jsonResponse({ error: 'Unsupported checkout intent' }, 400)
  }

  // Step 1: authenticate the caller as themselves (never service role) —
  // same pattern as send-beta-invitation/index.ts.
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user || !user.email) return jsonResponse({ error: 'Unauthorized' }, 401)

  // Step 2: resolve the commercial product entirely server-side. 'pro' is
  // the only self-serve paid plan; its price comes from `plans` (readable
  // by any authenticated user already) and falls back to the sandbox
  // placeholder only when unset, never to a client-supplied number.
  const { data: proPlan, error: planError } = await callerClient
    .from('plans')
    .select('id, code, monthly_price_cents, currency')
    .eq('code', 'pro')
    .maybeSingle()
  if (planError || !proPlan) return jsonResponse({ error: 'Pro plan is not configured' }, 500)

  const amountCents = proPlan.monthly_price_cents ?? SANDBOX_TEST_AMOUNT_CENTS
  const currency = proPlan.monthly_price_cents !== null ? proPlan.currency : SANDBOX_TEST_CURRENCY

  const merchantReference = `pip-pro-${user.id.replace(/-/g, '').slice(0, 12)}-${Date.now()}`

  const serviceClient = createClient(supabaseUrl, serviceRoleKey)

  // Step 3: mint the server-controlled mapping BEFORE calling Pesapal —
  // pesapal-ipn will only ever trust a merchant_reference it finds here.
  const { error: insertError } = await serviceClient.from('pesapal_checkout_orders').insert({
    user_id: user.id,
    merchant_reference: merchantReference,
    plan_code: 'pro',
    amount_cents: amountCents,
    currency,
    status: 'pending',
  })
  if (insertError) {
    console.error('pesapal-checkout: failed to create checkout order row:', insertError)
    return jsonResponse({ error: 'Failed to initiate checkout' }, 500)
  }

  // Step 4: Pesapal bearer token.
  const tokenResult = await requestPesapalToken(baseUrl, consumerKey, consumerSecret)
  if ('error' in tokenResult) {
    console.error('pesapal-checkout:', tokenResult.error)
    return jsonResponse({ error: 'Payment provider authentication failed' }, 502)
  }

  // Step 5: SubmitOrderRequest. subscription_details is Pesapal's
  // documented recurring-payment mechanism (RecurringPayments doc) —
  // whether the shopper is actually offered the recurring opt-in depends
  // on the payment method they choose inside Pesapal's own hosted iframe
  // (their docs describe this as a Visa/Mastercard-associated flow), not
  // on anything this function controls. end_date is set 3 years out as a
  // practical upper bound; Pesapal requires a bounded window for
  // subscription_details rather than an open-ended one.
  const now = new Date()
  const endDate = new Date(now)
  endDate.setUTCFullYear(endDate.getUTCFullYear() + 3)

  const submitRes = await fetch(`${baseUrl}/api/Transactions/SubmitOrderRequest`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${tokenResult.token}` },
    body: JSON.stringify({
      id: merchantReference,
      currency,
      amount: amountCents / 100,
      description: 'ARRIYIA Pro subscription (sandbox)',
      callback_url: callbackUrl,
      notification_id: ipnId,
      billing_address: {
        email_address: user.email,
        first_name: (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? null,
        last_name: (user.user_metadata?.full_name as string | undefined)?.split(' ').slice(1).join(' ') || null,
      },
      subscription_details: {
        start_date: formatPesapalDate(now),
        end_date: formatPesapalDate(endDate),
        frequency: 'MONTHLY',
      },
    }),
  })

  const submitBody = (await submitRes.json().catch(() => null)) as SubmitOrderResponse | null
  if (!submitRes.ok || !submitBody?.redirect_url || !submitBody?.order_tracking_id) {
    console.error('pesapal-checkout: SubmitOrderRequest failed:', submitRes.status, JSON.stringify(submitBody))
    await serviceClient.from('pesapal_checkout_orders').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('merchant_reference', merchantReference)
    return jsonResponse({ error: 'Failed to create Pesapal order' }, 502)
  }

  // Step 6: persist the tracking id so pesapal-ipn can find this order by
  // either merchant_reference or order_tracking_id.
  await serviceClient
    .from('pesapal_checkout_orders')
    .update({ order_tracking_id: submitBody.order_tracking_id, updated_at: new Date().toISOString() })
    .eq('merchant_reference', merchantReference)

  return jsonResponse({ redirectUrl: submitBody.redirect_url, merchantReference }, 200)
})
