import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { savePlanToNote } from '@/modules/planning-intelligence/api/savePlanToNote'
import type { Plan } from '@/modules/planning-intelligence/plan'

export function useSavePlanToNote(workspaceId: string | null) {
  const { user } = useAuth()

  return useMutation({
    mutationFn: (plan: Plan) => savePlanToNote({ plan, userId: user!.id, workspaceId }),
  })
}
