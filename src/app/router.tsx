import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { ProtectedRoute } from '@/modules/auth/ProtectedRoute'
import { RouteErrorBoundary } from '@/shared/components/errors/RouteErrorBoundary'
import { AppShell } from '@/shared/components/layout/AppShell'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { SignUpPage } from '@/modules/auth/pages/SignUpPage'
import { ForgotPasswordPage } from '@/modules/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/modules/auth/pages/ResetPasswordPage'
import { LibraryPage } from '@/modules/library/pages/LibraryPage'
import { DocumentDetailPage } from '@/modules/library/pages/DocumentDetailPage'
import { NotesPage } from '@/modules/notes/pages/NotesPage'
import { NoteDetailPage } from '@/modules/notes/pages/NoteDetailPage'
import { KnowledgePage } from '@/modules/knowledge/pages/KnowledgePage'
import { KnowledgeGraphPage } from '@/modules/knowledge-graph/pages/KnowledgeGraphPage'
import { KnowledgeExplorerPage } from '@/modules/knowledge-intelligence/pages/KnowledgeExplorerPage'
import { KnowledgeNodeDetailPage } from '@/modules/knowledge-intelligence/pages/KnowledgeNodeDetailPage'
import { KnowledgeCollectionsPage } from '@/modules/knowledge-intelligence/pages/KnowledgeCollectionsPage'
import { KnowledgeCollectionDetailPage } from '@/modules/knowledge-intelligence/pages/KnowledgeCollectionDetailPage'
import { SearchPage } from '@/modules/search/pages/SearchPage'
import { ChatPage } from '@/modules/ai/chat/pages/ChatPage'
import { SettingsPage } from '@/modules/settings/pages/SettingsPage'
import { AdvancedSettingsPage } from '@/modules/settings/pages/AdvancedSettingsPage'
import { WorkspaceManagementPage } from '@/modules/workspaces/pages/WorkspaceManagementPage'
import { WorkspaceMembersPage } from '@/modules/workspaces/pages/WorkspaceMembersPage'
import { WorkspaceCollaborationPage } from '@/modules/workspaces/pages/WorkspaceCollaborationPage'
import { MemoryManagementPage } from '@/modules/ai/memory/pages/MemoryManagementPage'
import { AiHealthPage } from '@/modules/ai/observability/pages/AiHealthPage'
import { ProviderHealthDetailPage } from '@/modules/ai/observability/pages/ProviderHealthDetailPage'
import { ReaderPage } from '@/modules/reader/pages/ReaderPage'
import { ImageReaderPage } from '@/modules/assets/pages/ImageReaderPage'
import { ExecutiveDashboardPage } from '@/modules/intelligence/dashboard/pages/ExecutiveDashboardPage'
import { WorkspaceEvolutionPage } from '@/modules/evolution/pages/WorkspaceEvolutionPage'
import { WorkspaceIntelligenceHubPage } from '@/modules/hub/pages/WorkspaceIntelligenceHubPage'
import { ExportCenterPage } from '@/modules/export/pages/ExportCenterPage'
import { PricingPage } from '@/modules/billing/pages/PricingPage'
import { BillingReturnPage } from '@/modules/billing/pages/BillingReturnPage'
import { FoundingProApplyPage } from '@/modules/founding-pro/pages/FoundingProApplyPage'
import { HomeRedirect } from '@/app/HomeRedirect'
import { AdminDashboardPage } from '@/modules/admin/pages/AdminDashboardPage'
import { AdminUsersPage } from '@/modules/admin/pages/AdminUsersPage'
import { AdminPlansPage } from '@/modules/admin/pages/AdminPlansPage'
import { AdminAiGovernancePage } from '@/modules/admin/pages/AdminAiGovernancePage'
import { AdminFoundingProPage } from '@/modules/admin/pages/AdminFoundingProPage'
import { RequireAdmin } from '@/modules/admin/RequireAdmin'

export const router = createBrowserRouter([
  // Post-10/10 Phase 5 (Application Hardening & App Experience) — a single
  // pathless root layout route wrapping every existing route unchanged, so
  // one shared errorElement replaces React Router's unbranded default error
  // page for any render error anywhere in the tree. Paths/behavior below
  // are otherwise identical to before this wrapper was added.
  {
    element: <Outlet />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignUpPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      // Phase 5C fix — /pricing must be reachable by typing the URL
      // directly, whether or not the visitor is signed in (confirmed
      // broken: nested under the ProtectedRoute-wrapped '/' subtree
      // below, it redirected every logged-out visitor to /login before
      // ever rendering). PricingPage itself already degrades gracefully
      // with no session (useCurrentPlan/useAuth both handle a null user),
      // and AuthProvider/WorkspaceProvider wrap the whole router in
      // App.tsx, so this route still has everything it needs outside
      // AppShell. Not nested under '/' on purpose — it must never depend
      // on ProtectedRoute's auth gate.
      { path: '/pricing', element: <PricingPage /> },
      {
        path: '/library/:documentId/read',
        element: (
          <ProtectedRoute>
            <ReaderPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/library/assets/:assetId',
        element: (
          <ProtectedRoute>
            <ImageReaderPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: 'dashboard', element: <ExecutiveDashboardPage /> },
          { path: 'evolution', element: <WorkspaceEvolutionPage /> },
          { path: 'hub', element: <WorkspaceIntelligenceHubPage /> },
          { path: 'collaboration', element: <WorkspaceCollaborationPage /> },
          { path: 'library', element: <LibraryPage /> },
          { path: 'library/:documentId', element: <DocumentDetailPage /> },
          { path: 'notes', element: <NotesPage /> },
          { path: 'notes/:noteId', element: <NoteDetailPage /> },
          { path: 'knowledge', element: <KnowledgePage /> },
          { path: 'knowledge/graph', element: <KnowledgeGraphPage /> },
          { path: 'knowledge/explorer', element: <KnowledgeExplorerPage /> },
          { path: 'knowledge/nodes/:nodeId', element: <KnowledgeNodeDetailPage /> },
          { path: 'knowledge/collections', element: <KnowledgeCollectionsPage /> },
          { path: 'knowledge/collections/:collectionId', element: <KnowledgeCollectionDetailPage /> },
          { path: 'knowledge/export', element: <ExportCenterPage /> },
          { path: 'search', element: <SearchPage /> },
          { path: 'chat', element: <ChatPage /> },
          { path: 'billing/return', element: <BillingReturnPage /> },
          { path: 'founding-pro/apply', element: <FoundingProApplyPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'settings/advanced', element: <AdvancedSettingsPage /> },
          { path: 'settings/workspaces', element: <WorkspaceManagementPage /> },
          { path: 'settings/workspaces/:workspaceId/members', element: <WorkspaceMembersPage /> },
          { path: 'settings/memory', element: <MemoryManagementPage /> },
          {
            path: 'settings/ai-health',
            element: (
              <RequireAdmin>
                <AiHealthPage />
              </RequireAdmin>
            ),
          },
          {
            path: 'settings/ai-health/provider/:providerId',
            element: (
              <RequireAdmin>
                <ProviderHealthDetailPage />
              </RequireAdmin>
            ),
          },
          {
            path: 'admin',
            element: (
              <RequireAdmin>
                <AdminDashboardPage />
              </RequireAdmin>
            ),
          },
          {
            path: 'admin/users',
            element: (
              <RequireAdmin>
                <AdminUsersPage />
              </RequireAdmin>
            ),
          },
          {
            path: 'admin/plans',
            element: (
              <RequireAdmin>
                <AdminPlansPage />
              </RequireAdmin>
            ),
          },
          {
            path: 'admin/ai',
            element: (
              <RequireAdmin>
                <AdminAiGovernancePage />
              </RequireAdmin>
            ),
          },
          {
            path: 'admin/founding-pro',
            element: (
              <RequireAdmin>
                <AdminFoundingProPage />
              </RequireAdmin>
            ),
          },
          { path: 'admin/beta', element: <Navigate to="/admin" replace /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
