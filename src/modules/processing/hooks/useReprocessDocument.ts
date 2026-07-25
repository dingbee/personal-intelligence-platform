import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/modules/auth/useAuth'
import { processDocument } from '@/modules/processing/pipeline/processDocument'

export function useReprocessDocument() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (documentId: string) => processDocument(documentId, user!.id),
    onSuccess: (_data, documentId) => {
      queryClient.invalidateQueries({ queryKey: ['processing-job', documentId] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}
