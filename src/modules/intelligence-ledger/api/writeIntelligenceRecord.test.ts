import { describe, expect, it, vi, beforeEach } from 'vitest'

const { createIntelligenceRecordMock } = vi.hoisted(() => ({
  createIntelligenceRecordMock: vi.fn(),
}))

vi.mock('@/modules/intelligence-ledger/api/createIntelligenceRecord', () => ({ createIntelligenceRecord: createIntelligenceRecordMock }))

import { writeIntelligenceRecord } from '@/modules/intelligence-ledger/api/writeIntelligenceRecord'

describe('writeIntelligenceRecord', () => {
  beforeEach(() => {
    createIntelligenceRecordMock.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('delegates straight through to createIntelligenceRecord on success and returns the created record', async () => {
    createIntelligenceRecordMock.mockResolvedValueOnce({ id: 'record-1' })

    const result = await writeIntelligenceRecord({ workspaceId: 'workspace-1', recordType: 'research', summary: 'x', structuredOutput: {} })

    expect(createIntelligenceRecordMock).toHaveBeenCalledWith({ workspaceId: 'workspace-1', recordType: 'research', summary: 'x', structuredOutput: {} })
    expect(result).toEqual({ id: 'record-1' })
  })

  it('never throws when the Ledger write fails — a caller mid-return must not have its own success turned into a crash — and returns null', async () => {
    createIntelligenceRecordMock.mockRejectedValueOnce(new Error('RLS: workspace access denied'))

    await expect(
      writeIntelligenceRecord({ workspaceId: 'workspace-1', recordType: 'research', summary: 'x', structuredOutput: {} }),
    ).resolves.toBeNull()
  })

  it('logs the failure via console.error rather than swallowing it silently', async () => {
    const error = new Error('boom')
    createIntelligenceRecordMock.mockRejectedValueOnce(error)

    await writeIntelligenceRecord({ workspaceId: 'workspace-1', recordType: 'research', summary: 'x', structuredOutput: {} })

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('failed to persist'), error)
  })
})
