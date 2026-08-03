import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/modules/auth/ProtectedRoute'
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
import { HomeRedirect } from '@/app/HomeRedirect'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignUpPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
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
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/workspaces', element: <WorkspaceManagementPage /> },
      { path: 'settings/workspaces/:workspaceId/members', element: <WorkspaceMembersPage /> },
      { path: 'settings/memory', element: <MemoryManagementPage /> },
      { path: 'settings/ai-health', element: <AiHealthPage /> },
      { path: 'settings/ai-health/provider/:providerId', element: <ProviderHealthDetailPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
