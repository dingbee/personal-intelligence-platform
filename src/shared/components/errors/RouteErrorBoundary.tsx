import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { ErrorFallback } from '@/shared/components/errors/ErrorFallback'

/**
 * Post-10/10 Phase 5 (Application Hardening & App Experience). Router
 * `errorElement` fallback — without one, React Router's data router renders
 * its own unbranded default error page (which surfaces the raw error
 * message) for any render error inside a route. This replaces it with the
 * same branded, detail-free fallback used outside the router, logging the
 * real error to the console for diagnosis without showing it to the user.
 */
export function RouteErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <ErrorFallback title="Page not found" description="That page doesn't exist or has moved." />
    )
  }

  console.error('RouteErrorBoundary caught an error:', error)
  return <ErrorFallback />
}
