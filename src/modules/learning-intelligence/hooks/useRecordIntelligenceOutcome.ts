import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recordIntelligenceOutcome } from '@/modules/learning-intelligence/api/recordIntelligenceOutcome'

/** The user-initiated "record what actually happened" path — throws on failure (unlike the automatic I7 -> I8 wiring) so the user sees a real error. See IntelligenceRecordDetailPage.tsx. */
export function useRecordIntelligenceOutcome(recordId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: recordIntelligenceOutcome,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['intelligence-record', recordId] })
      void queryClient.invalidateQueries({ queryKey: ['outcome-evaluations', recordId] })
      void queryClient.invalidateQueries({ queryKey: ['learning-signals'] })
    },
  })
}
