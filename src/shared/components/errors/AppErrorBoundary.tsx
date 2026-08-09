import { Component, type ReactNode } from 'react'
import { ErrorFallback } from '@/shared/components/errors/ErrorFallback'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

/**
 * Post-10/10 Phase 5 (Application Hardening & App Experience). Top-level
 * safety net for errors thrown outside the router's own error handling
 * (e.g. in AuthProvider/WorkspaceProvider, which wrap RouterProvider) —
 * without this, an uncaught render/effect error anywhere above the router
 * unmounts the whole tree to a blank white screen with no recovery path.
 * React error boundaries must be class components; there is no hooks
 * equivalent.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('AppErrorBoundary caught an error:', error)
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />
    }
    return this.props.children
  }
}
