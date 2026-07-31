import { Navigate } from 'react-router-dom'
import { useWorkspace } from '@/modules/workspaces/useWorkspace'

/**
 * UX-13.7.3 — "Workspace → Hub" instead of "Workspace → Documents": once a
 * workspace is selected, the app's root now opens straight to that
 * workspace's command center rather than the Library. Conditional (not a
 * static redirect) so a brand-new user with no workspace yet still lands
 * on Library — the Hub's own empty state assumes a workspace exists, and
 * this is exactly the "nothing set up yet" case that would otherwise be
 * a real onboarding regression.
 */
export function HomeRedirect() {
  const { currentWorkspaceId } = useWorkspace()
  return <Navigate to={currentWorkspaceId ? '/hub' : '/library'} replace />
}
