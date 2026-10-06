import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const CORE_GATEWAY_URL = Deno.env.get("NOVA_CORE_GATEWAY_URL")?.replace(/\\/$/, "")
const CORE_PLUGIN_SECRET = Deno.env.get("NOVA_CORE_PLUGIN_SECRET")
const PLUGIN_ID = "arriyia"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405)

  if (!CORE_GATEWAY_URL || !CORE_PLUGIN_SECRET) {
    return json({ error: "CORE_GATEWAY_NOT_CONFIGURED", message: "NoVA Core gateway configuration is missing." }, 503)
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "UNAUTHORIZED" }, 401)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!supabaseUrl || !anonKey) return json({ error: "FUNCTION_CONFIGURATION_ERROR" }, 500)

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData.user) return json({ error: "UNAUTHORIZED" }, 401)

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body.action !== "string" || !isUuid(body.workspaceId)) {
    return json({ error: "INVALID_REQUEST" }, 400)
  }

  const allowedActions = new Set(["register", "negotiate", "agent.run", "workflow.run", "tool.invoke"])
  if (!allowedActions.has(body.action)) return json({ error: "UNSUPPORTED_ACTION" }, 400)

  const { data: membership, error: membershipError } = await callerClient
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", body.workspaceId)
    .eq("user_id", userData.user.id)
    .maybeSingle()

  if (membershipError) return json({ error: "AUTHORIZATION_LOOKUP_FAILED" }, 500)
  if (!membership) return json({ error: "FORBIDDEN", message: "You are not a member of this Business Space." }, 403)

  const { data: workspace, error: workspaceError } = await callerClient
    .from("workspaces")
    .select("id,v2_organization_id,v2_kind,v2_status,v2_subscription")
    .eq("id", body.workspaceId)
    .maybeSingle()

  if (workspaceError) return json({ error: "SPACE_LOOKUP_FAILED" }, 500)
  if (!workspace || workspace.v2_kind !== "business" || workspace.v2_status !== "active" || workspace.v2_subscription !== "enterprise" || !isUuid(workspace.v2_organization_id)) {
    return json({ error: "INVALID_RUNTIME_SPACE", message: "An active Enterprise Business Space is required." }, 409)
  }

  const upstreamBody = { ...body }
  delete upstreamBody.workspaceId

  const upstream = await fetch(CORE_GATEWAY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${CORE_PLUGIN_SECRET}`,
      "x-nova-plugin-id": PLUGIN_ID,
      "x-nova-organization-id": workspace.v2_organization_id,
    },
    body: JSON.stringify(upstreamBody),
  }).catch((error) => ({ error }))

  if ("error" in upstream) {
    return json({ error: "CORE_GATEWAY_UNREACHABLE", message: "NoVA Core could not be reached." }, 502)
  }

  const responseBody = await upstream.text()
  return new Response(responseBody, {
    status: upstream.status,
    headers: { ...corsHeaders, "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  })
})
