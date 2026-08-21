import { describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { reportDocumentProcessingFailure } from '@/modules/processing/api/systemHealth'

describe('reportDocumentProcessingFailure', () => {
  it('calls the narrow report_document_processing_failure RPC with exactly the document id and error message', async () => {
    rpcMock.mockResolvedValueOnce({ data: 'event-1', error: null })

    await reportDocumentProcessingFailure('doc-1', 'extraction failed')

    expect(rpcMock).toHaveBeenCalledWith('report_document_processing_failure', {
      p_document_id: 'doc-1',
      p_error_message: 'extraction failed',
    })
  })

  it('throws when the RPC rejects — e.g. the document does not belong to the caller', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('Not authorized') })

    await expect(reportDocumentProcessingFailure('doc-1', 'extraction failed')).rejects.toThrow('Not authorized')
  })
})
