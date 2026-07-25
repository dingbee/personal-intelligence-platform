import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/modules/auth/AuthContext'
import { WorkspaceProvider } from '@/modules/workspaces/context/WorkspaceProvider'
import { queryClient } from '@/shared/lib/queryClient'
import { router } from '@/app/router'
// Side-effect imports: register built-in platform/search providers before
// anything tries to read from those registries. See modules/core/README.md.
import '@/modules/core/modules/coreModule'
import '@/modules/search/registerBuiltInProviders'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <RouterProvider router={router} />
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
