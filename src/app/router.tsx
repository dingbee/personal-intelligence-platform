import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/modules/auth/ProtectedRoute'
import { AppShell } from '@/shared/components/layout/AppShell'
import { LoginPage } from '@/modules/auth/pages/LoginPage'
import { SignUpPage } from '@/modules/auth/pages/SignUpPage'
import { ForgotPasswordPage } from '@/modules/auth/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/modules/auth/pages/ResetPasswordPage'
import { LibraryPage } from '@/modules/library/pages/LibraryPage'
import { NotesPage } from '@/modules/notes/pages/NotesPage'
import { SearchPage } from '@/modules/search/pages/SearchPage'
import { ChatPage } from '@/modules/ai/chat/pages/ChatPage'
import { SettingsPage } from '@/modules/settings/pages/SettingsPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignUpPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
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
      { path: 'notes', element: <NotesPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
