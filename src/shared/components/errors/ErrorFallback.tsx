import { Button } from '@/shared/components/ui/Button'
import { appConfig } from '@/app/appConfig'

interface ErrorFallbackProps {
  title?: string
  description?: string
}

/**
 * Post-10/10 Phase 5 (Application Hardening & App Experience). Shared
 * presentational fallback for both AppErrorBoundary (render/effect errors
 * outside the router) and RouteErrorBoundary (errors within a route).
 * Deliberately shows only a safe, generic message — never the caught
 * error's message or stack, which could contain internal details.
 */
export function ErrorFallback({
  title = 'Something went wrong',
  description = `${appConfig.productName} hit an unexpected error. Reloading usually fixes it — your data is safe.`,
}: ErrorFallbackProps) {
  return (
    <div className="flex h-screen h-dvh flex-col items-center justify-center gap-4 bg-[var(--color-canvas)] px-6 text-center">
      <h1 className="text-lg font-medium text-[var(--color-ink)]">{title}</h1>
      <p className="max-w-sm text-sm text-[var(--color-ink-muted)]">{description}</p>
      <Button onClick={() => window.location.assign('/')}>Reload {appConfig.productName}</Button>
    </div>
  )
}
