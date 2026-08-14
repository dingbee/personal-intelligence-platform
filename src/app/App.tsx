import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/modules/auth/AuthContext'
import { WorkspaceProvider } from '@/modules/workspaces/context/WorkspaceProvider'
import { queryClient } from '@/shared/lib/queryClient'
import { router } from '@/app/router'
import { appConfig } from '@/app/appConfig'
import { AppErrorBoundary } from '@/shared/components/errors/AppErrorBoundary'
// Side-effect imports: register built-in platform/search providers before
// anything tries to read from those registries. See modules/core/README.md.
import '@/modules/core/modules/coreModule'
import '@/modules/knowledge-intelligence/module'
import '@/modules/processing/documentIntelligence/module'
import '@/modules/ai/artifacts/module'
import '@/modules/workspace-intelligence/module'
import '@/modules/data-intelligence/module'
import '@/modules/analysis-intelligence/module'
import '@/modules/search/registerBuiltInProviders'
import '@/modules/commands/registerBuiltInCommands'
import '@/modules/workspace-actions/registerBuiltInWorkspaceActions'

export function App() {
  useEffect(() => {
    document.title = appConfig.productName
  }, [])

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WorkspaceProvider>
            <RouterProvider router={router} />
          </WorkspaceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}
