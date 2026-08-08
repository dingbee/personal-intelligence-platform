import { describe, expect, it } from 'vitest'
import {
  planProjectCommand,
  planLearningCommand,
  planResearchCommand,
  planReadingCommand,
  planWritingCommand,
  planMigrationCommand,
} from '@/modules/commands/commands/planningCommands'
import { classifyIntent } from '@/modules/intelligence/intent/intentClassifier'
import type { CommandActions, CommandContext } from '@/modules/commands/types'

const ALL_PLAN_COMMANDS = [
  planProjectCommand,
  planLearningCommand,
  planResearchCommand,
  planReadingCommand,
  planWritingCommand,
  planMigrationCommand,
]

function commandContext(): CommandContext {
  return { userId: 'u1', workspaceId: null, workspaceName: null, pathname: '/', documentId: null, inProgressDocument: null }
}

describe('planning commands', () => {
  it('gives every planning command a unique id', () => {
    const ids = ALL_PLAN_COMMANDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('starts a conversation via createConversationWithQuery, the same mechanism askNovaCommand already uses', async () => {
    let capturedQuery: string | null = null
    const actions: CommandActions = {
      navigate: () => {},
      setCurrentWorkspaceId: () => {},
      createNote: async () => ({ id: 'note-1' }),
      createConversationWithQuery: async (query: string) => {
        capturedQuery = query
        return { id: 'conv-1' }
      },
      createConversationWithNoteAnalysis: async () => ({ id: 'conv-1' }),
      openQuickCapture: () => {},
    }
    await planProjectCommand.execute(commandContext(), actions)
    expect(capturedQuery).toBe('Help me plan my project.')
  })

  it("every planning command's opening query classifies to the 'plan' intent", async () => {
    for (const command of ALL_PLAN_COMMANDS) {
      let capturedQuery = ''
      const actions: CommandActions = {
        navigate: () => {},
        setCurrentWorkspaceId: () => {},
        createNote: async () => ({ id: 'note-1' }),
        createConversationWithQuery: async (query: string) => {
          capturedQuery = query
          return { id: 'conv-1' }
        },
        createConversationWithNoteAnalysis: async () => ({ id: 'conv-1' }),
        openQuickCapture: () => {},
      }
      await command.execute(commandContext(), actions)
      expect(classifyIntent(capturedQuery).intent).toBe('plan')
    }
  })
})
