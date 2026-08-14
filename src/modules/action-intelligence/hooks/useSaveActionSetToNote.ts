import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { saveActionSetToNote } from '@/modules/action-intelligence/api/saveActionSetToNote'
import type { ActionSet } from '@/modules/action-intelligence/action'

export function useSaveActionSetToNote(workspaceId: string | null) {
  const { user } = useAuth()

  return useMutation({
    mutationFn: (actionSet: ActionSet) => saveActionSetToNote({ actionSet, userId: user!.id, workspaceId }),
  })
}
