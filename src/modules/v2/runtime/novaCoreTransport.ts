import { supabase } from '@/shared/lib/supabase'

export const NOVA_CORE_GATEWAY_FUNCTION = 'nova-core-gateway' as const

export type NovaCoreAction =
  | 'register'
  | 'negotiate'
  | 'agent.run'
  | 'workflow.run'
  | 'tool.invoke'

export interface NovaCoreTransportRequest {
  action: NovaCoreAction
  workspaceId: string
  [key: string]: unknown
}

export interface NovaCoreTransportResponse {
  ok: boolean
  [key: string]: unknown
}

/**
 * Browser-safe ARRIYIA → Supabase Edge Function boundary.
 *
 * The NoVA Core gateway credential never enters browser code. The Edge
 * Function authenticates the caller, resolves the Business Space's
 * v2_organization_id, and injects the Core gateway credential server-side.
 */
export async function invokeNovaCore(
  request: NovaCoreTransportRequest,
): Promise<NovaCoreTransportResponse> {
  if (!request.workspaceId) {
    throw new Error('NoVA Core requests require an ARRIYIA Business Space.')
  }

  const { data, error } = await supabase.functions.invoke(NOVA_CORE_GATEWAY_FUNCTION, {
    body: request,
  })

  if (error) {
    const context = 'context' in error ? (error as { context?: unknown }).context : undefined
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null)
      const message = payload && typeof payload === 'object' && 'message' in payload
        ? String(payload.message)
        : error.message
      throw new Error(message)
    }
    throw new Error(error.message)
  }

  if (!data || typeof data !== 'object') {
    throw new Error('NoVA Core returned an invalid gateway response.')
  }

  return data as NovaCoreTransportResponse
}
