import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { saveResearchToNote } from '@/modules/research-intelligence/api/saveResearchToNote'
import type { ResearchInvestigation } from '@/modules/research-intelligence/researchInvestigation'

export function useSaveResearchToNote(workspaceId: string | null) {
  const { user } = useAuth()

  return useMutation({
    mutationFn: (investigation: ResearchInvestigation) => saveResearchToNote({ investigation, userId: user!.id, workspaceId }),
  })
}
