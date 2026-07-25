import { createContext } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { Workspace } from '@/shared/types/database'

export interface WorkspaceContextValue {
  workspaces: Workspace[]
  isLoading: boolean
  /** null = "All" — the backward-compatible default showing every document/collection regardless of workspace. */
  currentWorkspaceId: string | null
  setCurrentWorkspaceId: (id: string | null) => void
  create: UseMutationResult<Workspace, Error, string, unknown>
}

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined)
