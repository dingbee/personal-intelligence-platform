import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { saveDecisionToNote } from '@/modules/decision-intelligence/api/saveDecisionToNote'
import type { Decision } from '@/modules/decision-intelligence/decision'

export function useSaveDecisionToNote(workspaceId: string | null) {
  const { user } = useAuth()

  return useMutation({
    mutationFn: (decision: Decision) => saveDecisionToNote({ decision, userId: user!.id, workspaceId }),
  })
}
