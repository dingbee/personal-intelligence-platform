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
import { SearchPage } from '@/modules/search/pages/SearchPage'
import { ChatPage } from '@/modules/ai/chat/pages/ChatPage'
import { SettingsPage } from '@/modules/settings/pages/SettingsPage'
import { WorkspaceManagementPage } from '@/modules/workspaces/pages/WorkspaceManagementPage'
import { MemoryManagementPage } from '@/modules/ai/memory/pages/MemoryManagementPage'
import { AiHealthPage } from '@/modules/ai/observability/pages/AiHealthPage'
import { ProviderHealthDetailPage } from '@/modules/ai/observability/pages/ProviderHealthDetailPage'
import { ReaderPage } from '@/modules/reader/pages/ReaderPage'

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
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/library" replace /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'library/:documentId', element: <DocumentDetailPage /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'notes/:noteId', element: <NoteDetailPage /> },
      { path: 'knowledge', element: <KnowledgePage /> },
      { path: 'knowledge/graph', element: <KnowledgeGraphPage /> },
      { path: 'knowledge/explorer', element: <KnowledgeExplorerPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/workspaces', element: <WorkspaceManagementPage /> },
      { path: 'settings/memory', element: <MemoryManagementPage /> },
      { path: 'settings/ai-health', element: <AiHealthPage /> },
      { path: 'settings/ai-health/provider/:providerId', element: <ProviderHealthDetailPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
