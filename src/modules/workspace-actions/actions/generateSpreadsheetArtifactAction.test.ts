import { beforeAll, describe, expect, it, vi } from 'vitest'
import { promptRegistry } from '@/modules/core/prompts/registry'
import type { WorkspaceActionContext } from '@/modules/workspace-actions/types'

// Same approach AIService.test.ts already uses: mock the lowest layer
// (streamChatCompletion) and let the real runCapability/runWithFallback
// run against it, so this suite exercises the actual pipeline wiring
// (parse -> validate -> compile -> formula safety -> render) without any
// network call.
const { streamChatCompletionMock } = vi.hoisted(() => ({
  streamChatCompletionMock: vi.fn(async (_params: { system: string }) => ({ content: '', model: 'test-model' })),
}))
vi.mock('@/modules/ai/orchestration/streamChatCompletion', () => ({ streamChatCompletion: streamChatCompletionMock }))

import { generateSpreadsheetArtifactAction } from '@/modules/workspace-actions/actions/generateSpreadsheetArtifactAction'

beforeAll(() => {
  promptRegistry.register({
    id: 'generate-spreadsheet-artifact@1.0',
    capabilityId: 'generate-spreadsheet-artifact',
    version: '1.0',
    active: true,
    template: 'Request: {{request}}',
  })
})

function context(): WorkspaceActionContext {
  return { userId: 'user-1', workspaceId: 'workspace-1', conversationId: 'conv-1', chain: ['openai'] }
}

function mockModelResponse(content: string) {
  streamChatCompletionMock.mockResolvedValueOnce({ content, model: 'test-model' })
}

describe('generateSpreadsheetArtifactAction', () => {
  it('matches "create a spreadsheet for X" via the deterministic command parser', () => {
    expect(generateSpreadsheetArtifactAction.match('create a spreadsheet for a monthly budget')).toEqual({
      request: 'a monthly budget',
    })
    expect(generateSpreadsheetArtifactAction.match('what is the weather today')).toBeUndefined()
  })

  it('renders a markdown table and an explicit "not saved yet" prompt for a valid, safe specification', async () => {
    mockModelResponse(
      JSON.stringify({
        title: 'Monthly Budget',
        kind: 'template',
        sheets: [
          {
            name: 'Budget',
            columns: [{ name: 'Category' }, { name: 'Amount' }],
            rows: [{ values: ['Rent', 1200] }, { values: ['Groceries', 400] }],
          },
        ],
      }),
    )

    const outcome = await generateSpreadsheetArtifactAction.run({ request: 'a monthly budget' }, context())

    expect(outcome.responseText).toContain('Monthly Budget')
    expect(outcome.responseText).toContain('| Category | Amount |')
    expect(outcome.responseText).toContain('| Rent | 1200 |')
    expect(outcome.responseText).toContain('save this')
  })

  it('renders a safe formula resolved to a real cell reference', async () => {
    mockModelResponse(
      JSON.stringify({
        title: 'Revenue Model',
        kind: 'data_model',
        sheets: [
          {
            name: 'Sheet 1',
            columns: [{ name: 'Revenue' }, { name: 'Expenses' }, { name: 'Profit' }],
            rows: [{ values: [1000, 400, null] }],
            formulas: [{ column: 'Profit', row: 1, expression: '{{Revenue}}-{{Expenses}}' }],
          },
        ],
      }),
    )

    const outcome = await generateSpreadsheetArtifactAction.run({ request: 'a revenue model' }, context())
    expect(outcome.responseText).toContain('=A2-B2')
  })

  it('rejects gracefully when the model response contains no JSON object at all', async () => {
    mockModelResponse('I am not able to help with that.')

    const outcome = await generateSpreadsheetArtifactAction.run({ request: 'nonsense' }, context())
    expect(outcome.responseText).toMatch(/wasn't able to generate/i)
    expect(outcome.responseText).not.toContain('|')
  })

  it('rejects with the specific reasons when the specification fails structural validation', async () => {
    mockModelResponse(
      JSON.stringify({
        title: 'Broken Spec',
        kind: 'template',
        sheets: [
          {
            name: 'Sheet 1',
            columns: [{ name: 'A' }, { name: 'B' }],
            // Ragged row: 1 value declared for 2 columns.
            rows: [{ values: ['only one'] }],
          },
        ],
      }),
    )

    const outcome = await generateSpreadsheetArtifactAction.run({ request: 'a broken table' }, context())
    expect(outcome.responseText).toMatch(/couldn't build that spreadsheet/i)
    expect(outcome.responseText).toContain('Row has 1 values but the sheet declares 2 columns')
    expect(outcome.responseText).not.toContain('|')
  })

  it('rejects a specification whose formula resolves to a disallowed function, without rendering any part of it', async () => {
    mockModelResponse(
      JSON.stringify({
        title: 'Suspicious Model',
        kind: 'data_model',
        sheets: [
          {
            name: 'Sheet 1',
            columns: [{ name: 'Revenue' }, { name: 'Lookup' }],
            rows: [{ values: [1000, null] }],
            formulas: [{ column: 'Lookup', row: 1, expression: 'WEBSERVICE({{Revenue}})' }],
          },
        ],
      }),
    )

    const outcome = await generateSpreadsheetArtifactAction.run({ request: 'a suspicious model' }, context())
    expect(outcome.responseText).toMatch(/isn't allowed for safety reasons/i)
    expect(outcome.responseText).not.toContain('WEBSERVICE')
    expect(outcome.responseText).not.toContain('|')
  })

  it('tolerates a markdown code fence around the JSON response', async () => {
    mockModelResponse(
      '```json\n' +
        JSON.stringify({
          title: 'Fenced',
          kind: 'template',
          sheets: [{ name: 'Sheet 1', columns: [{ name: 'A' }], rows: [{ values: ['x'] }] }],
        }) +
        '\n```',
    )

    const outcome = await generateSpreadsheetArtifactAction.run({ request: 'fenced' }, context())
    expect(outcome.responseText).toContain('Fenced')
  })
})
