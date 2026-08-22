import { useQuery } from '@tanstack/react-query'
import { getLearningSignalProvenance } from '@/modules/learning-intelligence/api/getLearningSignalProvenance'

/** The full I8.19 chain for one signal — its evidence, the real records that evidence was evaluated against, and any contradiction links. See LearningPage.tsx. */
export function useLearningSignalProvenance(signalId: string | null) {
  return useQuery({
    queryKey: ['learning-signal-provenance', signalId],
    queryFn: () => getLearningSignalProvenance(signalId!),
    enabled: Boolean(signalId),
  })
}
