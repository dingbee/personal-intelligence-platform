import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { createWorkspace, listWorkspaces } from '@/modules/workspaces/api/workspaces'
import { WorkspaceContext, type WorkspaceContextValue } from '@/modules/workspaces/context/context'

function storageKey(userId: string): string {
  return `current-workspace:${userId}`
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [currentWorkspaceId, setCurrentWorkspaceIdState] = useState<string | null>(null)

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: listWorkspaces,
    enabled: Boolean(user),
  })

  useEffect(() => {
    if (!user) return
    setCurrentWorkspaceIdState(localStorage.getItem(storageKey(user.id)))
  }, [user])

  const setCurrentWorkspaceId = useCallback(
    (id: string | null) => {
      setCurrentWorkspaceIdState(id)
      if (!user) return
      if (id) localStorage.setItem(storageKey(user.id), id)
      else localStorage.removeItem(storageKey(user.id))
    },
    [user],
  )

  const create = useMutation({
    mutationFn: (name: string) => createWorkspace({ name, userId: user!.id }),
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      setCurrentWorkspaceId(workspace.id)
    },
  })

  const value = useMemo<WorkspaceContextValue>(
    () => ({ workspaces, isLoading, currentWorkspaceId, setCurrentWorkspaceId, create }),
    [workspaces, isLoading, currentWorkspaceId, setCurrentWorkspaceId, create],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
