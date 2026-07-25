import { useContext } from 'react'
import { WorkspaceContext } from '@/modules/workspaces/context/context'

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider')
  return ctx
}
