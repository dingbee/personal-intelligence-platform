import { useQuery } from '@tanstack/react-query'
import { getCheckoutOrderByReference } from '@/modules/billing/api/billing'

/**
 * Phase 5B Pesapal Sandbox Billing — polls a checkout order's status
 * while it's still 'pending', same shape as
 * useExtractionMetadata/useDocumentChunkCount's existing 2s-poll-until-
 * terminal pattern. Stops polling the moment pesapal-ipn (independently
 * verified with Pesapal) resolves it to 'completed' or 'failed'.
 */
export function useCheckoutOrderStatus(merchantReference: string | null) {
  return useQuery({
    queryKey: ['checkout-order', merchantReference],
    queryFn: () => getCheckoutOrderByReference(merchantReference!),
    enabled: Boolean(merchantReference),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 2000 : false),
  })
}
