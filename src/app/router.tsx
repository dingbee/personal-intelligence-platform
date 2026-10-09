import { lazy } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { ProtectedRoute } from '@/modules/auth/ProtectedRoute'
import { RouteErrorBoundary } from '@/shared/components/errors/RouteErrorBoundary'
import { AppShell } from '@/shared/components/layout/AppShell'




















































import { RequireAdmin } from '@/modules/admin/RequireAdmin'







import { RequireArriyiaEnterprise } from '@/modules/v2/RequireArriyiaEnterprise'
import { V2Shell } from '@/modules/v2/V2Shell'

const LoginPage = lazy(() => import('@/modules/auth/pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const SignUpPage = lazy(() => import('@/modules/auth/pages/SignUpPage').then((module) => ({ default: module.SignUpPage })))
const ForgotPasswordPage = lazy(() => import('@/modules/auth/pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/modules/auth/pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })))
const LibraryPage = lazy(() => import('@/modules/library/pages/LibraryPage').then((module) => ({ default: module.LibraryPage })))
const DocumentDetailPage = lazy(() => import('@/modules/library/pages/DocumentDetailPage').then((module) => ({ default: module.DocumentDetailPage })))
const NotesPage = lazy(() => import('@/modules/notes/pages/NotesPage').then((module) => ({ default: module.NotesPage })))
const NoteDetailPage = lazy(() => import('@/modules/notes/pages/NoteDetailPage').then((module) => ({ default: module.NoteDetailPage })))
const KnowledgePage = lazy(() => import('@/modules/knowledge/pages/KnowledgePage').then((module) => ({ default: module.KnowledgePage })))
const KnowledgeGraphPage = lazy(() => import('@/modules/knowledge-graph/pages/KnowledgeGraphPage').then((module) => ({ default: module.KnowledgeGraphPage })))
const KnowledgeExplorerPage = lazy(() => import('@/modules/knowledge-intelligence/pages/KnowledgeExplorerPage').then((module) => ({ default: module.KnowledgeExplorerPage })))
const KnowledgeNodeDetailPage = lazy(() => import('@/modules/knowledge-intelligence/pages/KnowledgeNodeDetailPage').then((module) => ({ default: module.KnowledgeNodeDetailPage })))
const KnowledgeCollectionsPage = lazy(() => import('@/modules/knowledge-intelligence/pages/KnowledgeCollectionsPage').then((module) => ({ default: module.KnowledgeCollectionsPage })))
const KnowledgeCollectionDetailPage = lazy(() => import('@/modules/knowledge-intelligence/pages/KnowledgeCollectionDetailPage').then((module) => ({ default: module.KnowledgeCollectionDetailPage })))
const SearchPage = lazy(() => import('@/modules/search/pages/SearchPage').then((module) => ({ default: module.SearchPage })))
const ChatPage = lazy(() => import('@/modules/ai/chat/pages/ChatPage').then((module) => ({ default: module.ChatPage })))
const SettingsPage = lazy(() => import('@/modules/settings/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const AdvancedSettingsPage = lazy(() => import('@/modules/settings/pages/AdvancedSettingsPage').then((module) => ({ default: module.AdvancedSettingsPage })))
const WorkspaceManagementPage = lazy(() => import('@/modules/workspaces/pages/WorkspaceManagementPage').then((module) => ({ default: module.WorkspaceManagementPage })))
const WorkspaceMembersPage = lazy(() => import('@/modules/workspaces/pages/WorkspaceMembersPage').then((module) => ({ default: module.WorkspaceMembersPage })))
const WorkspaceCollaborationPage = lazy(() => import('@/modules/workspaces/pages/WorkspaceCollaborationPage').then((module) => ({ default: module.WorkspaceCollaborationPage })))
const MemoryManagementPage = lazy(() => import('@/modules/ai/memory/pages/MemoryManagementPage').then((module) => ({ default: module.MemoryManagementPage })))
const AiHealthPage = lazy(() => import('@/modules/ai/observability/pages/AiHealthPage').then((module) => ({ default: module.AiHealthPage })))
const ProviderHealthDetailPage = lazy(() => import('@/modules/ai/observability/pages/ProviderHealthDetailPage').then((module) => ({ default: module.ProviderHealthDetailPage })))
const ReaderPage = lazy(() => import('@/modules/reader/pages/ReaderPage').then((module) => ({ default: module.ReaderPage })))
const ImageReaderPage = lazy(() => import('@/modules/assets/pages/ImageReaderPage').then((module) => ({ default: module.ImageReaderPage })))
const ExecutiveDashboardPage = lazy(() => import('@/modules/intelligence/dashboard/pages/ExecutiveDashboardPage').then((module) => ({ default: module.ExecutiveDashboardPage })))
const WorkspaceEvolutionPage = lazy(() => import('@/modules/evolution/pages/WorkspaceEvolutionPage').then((module) => ({ default: module.WorkspaceEvolutionPage })))
const WorkspaceIntelligenceHubPage = lazy(() => import('@/modules/hub/pages/WorkspaceIntelligenceHubPage').then((module) => ({ default: module.WorkspaceIntelligenceHubPage })))
const ExportCenterPage = lazy(() => import('@/modules/export/pages/ExportCenterPage').then((module) => ({ default: module.ExportCenterPage })))
const ResearchPage = lazy(() => import('@/modules/research-intelligence/pages/ResearchPage').then((module) => ({ default: module.ResearchPage })))
const PlanningPage = lazy(() => import('@/modules/planning-intelligence/pages/PlanningPage').then((module) => ({ default: module.PlanningPage })))
const DecisionPage = lazy(() => import('@/modules/decision-intelligence/pages/DecisionPage').then((module) => ({ default: module.DecisionPage })))
const ActionsPage = lazy(() => import('@/modules/action-intelligence/pages/ActionsPage').then((module) => ({ default: module.ActionsPage })))
const ExecutionsPage = lazy(() => import('@/modules/execution-foundation/pages/ExecutionsPage').then((module) => ({ default: module.ExecutionsPage })))
const LearningPage = lazy(() => import('@/modules/learning-intelligence/pages/LearningPage').then((module) => ({ default: module.LearningPage })))
const HistoryPage = lazy(() => import('@/modules/intelligence-ledger/pages/HistoryPage').then((module) => ({ default: module.HistoryPage })))
const IntelligenceRecordDetailPage = lazy(() => import('@/modules/intelligence-ledger/pages/IntelligenceRecordDetailPage').then((module) => ({ default: module.IntelligenceRecordDetailPage })))
const IntelligenceJourneyDetailPage = lazy(() => import('@/modules/intelligence-ledger/pages/IntelligenceJourneyDetailPage').then((module) => ({ default: module.IntelligenceJourneyDetailPage })))
const WelcomePage = lazy(() => import('@/modules/onboarding/pages/WelcomePage').then((module) => ({ default: module.WelcomePage })))
const PricingPage = lazy(() => import('@/modules/billing/pages/PricingPage').then((module) => ({ default: module.PricingPage })))
const BillingReturnPage = lazy(() => import('@/modules/billing/pages/BillingReturnPage').then((module) => ({ default: module.BillingReturnPage })))
const FoundingProApplyPage = lazy(() => import('@/modules/founding-pro/pages/FoundingProApplyPage').then((module) => ({ default: module.FoundingProApplyPage })))
const FoundingProInvitationPage = lazy(() => import('@/modules/founding-pro/pages/FoundingProInvitationPage').then((module) => ({ default: module.FoundingProInvitationPage })))
const AdminDashboardPage = lazy(() => import('@/modules/admin/pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })))
const AdminUsersPage = lazy(() => import('@/modules/admin/pages/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })))
const AdminPlansPage = lazy(() => import('@/modules/admin/pages/AdminPlansPage').then((module) => ({ default: module.AdminPlansPage })))
const AdminAiGovernancePage = lazy(() => import('@/modules/admin/pages/AdminAiGovernancePage').then((module) => ({ default: module.AdminAiGovernancePage })))
const AdminFoundingProPage = lazy(() => import('@/modules/admin/pages/AdminFoundingProPage').then((module) => ({ default: module.AdminFoundingProPage })))
const AdminBillingPage = lazy(() => import('@/modules/admin/pages/AdminBillingPage').then((module) => ({ default: module.AdminBillingPage })))
const AdminUsageQuotasPage = lazy(() => import('@/modules/admin/pages/AdminUsageQuotasPage').then((module) => ({ default: module.AdminUsageQuotasPage })))
const AdminSystemHealthPage = lazy(() => import('@/modules/admin/pages/AdminSystemHealthPage').then((module) => ({ default: module.AdminSystemHealthPage })))
const V2FoundationPage = lazy(() => import('@/modules/v2/pages/V2FoundationPage').then((module) => ({ default: module.V2FoundationPage })))
const V2CommandCentrePage = lazy(() => import('@/modules/v2/pages/V2CommandCentrePage').then((module) => ({ default: module.V2CommandCentrePage })))
const V2IntelligenceCentrePage = lazy(() => import('@/modules/v2/pages/V2IntelligenceCentrePage').then((module) => ({ default: module.V2IntelligenceCentrePage })))
const V2KnowledgeMemoryPage = lazy(() => import('@/modules/v2/pages/V2KnowledgeMemoryPage').then((module) => ({ default: module.V2KnowledgeMemoryPage })))
const V2LearningCentrePage = lazy(() => import('../modules/v2/pages/V2LearningCentrePage').then((module) => ({ default: module.V2LearningCentrePage })))
const V2AgentManagementPage = lazy(() => import('@/modules/v2/pages/V2AgentManagementPage').then((module) => ({ default: module.V2AgentManagementPage })))
const V2WorkflowStudioPage = lazy(() => import('@/modules/v2/pages/V2WorkflowStudioPage').then((module) => ({ default: module.V2WorkflowStudioPage })))
const V2GovernancePage = lazy(() => import('@/modules/v2/pages/V2GovernancePage').then((module) => ({ default: module.V2GovernancePage })))

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
        path: '/v2',
        element: (
          <ProtectedRoute>
            <RequireArriyiaEnterprise>
              <V2Shell />
            </RequireArriyiaEnterprise>
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <V2CommandCentrePage /> },
          { path: 'foundation', element: <V2FoundationPage /> },
          { path: 'intelligence', element: <V2IntelligenceCentrePage /> },
          { path: 'knowledge-memory', element: <V2KnowledgeMemoryPage /> },
          { path: 'learning', element: <V2LearningCentrePage /> },
          { path: 'workflows', element: <V2WorkflowStudioPage /> },
          { path: 'agents', element: <V2AgentManagementPage /> },
          { path: 'governance', element: <V2GovernancePage /> },
        ],
      },
      {
        path: '/welcome',
        element: (
          <ProtectedRoute>
            <WelcomePage />
          </ProtectedRoute>
        ),
      },
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
          { index: true, element: <Navigate to="/v2" replace /> },
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
          { path: 'research', element: <ResearchPage /> },
          { path: 'planning', element: <PlanningPage /> },
          { path: 'decisions', element: <DecisionPage /> },
          { path: 'actions', element: <ActionsPage /> },
          { path: 'executions', element: <ExecutionsPage /> },
          { path: 'learning', element: <LearningPage /> },
          { path: 'history', element: <HistoryPage /> },
          { path: 'history/records/:recordId', element: <IntelligenceRecordDetailPage /> },
          { path: 'history/journeys/:journeyId', element: <IntelligenceJourneyDetailPage /> },
          { path: 'chat', element: <ChatPage /> },
          { path: 'billing/return', element: <BillingReturnPage /> },
          { path: 'founding-pro/apply', element: <FoundingProApplyPage /> },
          { path: 'founding-pro/invitation', element: <FoundingProInvitationPage /> },
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
          {
            path: 'admin/billing',
            element: (
              <RequireAdmin>
                <AdminBillingPage />
              </RequireAdmin>
            ),
          },
          {
            path: 'admin/usage',
            element: (
              <RequireAdmin>
                <AdminUsageQuotasPage />
              </RequireAdmin>
            ),
          },
          {
            path: 'admin/system-health',
            element: (
              <RequireAdmin>
                <AdminSystemHealthPage />
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
