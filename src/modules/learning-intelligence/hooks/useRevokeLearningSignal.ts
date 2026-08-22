import { useMutation, useQueryClient } from '@tanstack/react-query'
import { revokeLearningSignal } from '@/modules/learning-intelligence/api/revokeLearningSignal'

/** I8.21 User Control — the only mutation a user applies to a learning signal directly. */
export function useRevokeLearningSignal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ signalId, reason }: { signalId: string; reason?: string }) => revokeLearningSignal(signalId, reason),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['learning-signals'] })
      void queryClient.invalidateQueries({ queryKey: ['learning-signal-provenance', data.id] })
    },
  })
}
