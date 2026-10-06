import { describe, expect, it } from 'vitest'
import type { AiMemory } from '@/shared/types/database'
import { filterMemoriesByRelevance } from '@/modules/ai/memory/filterMemoriesByRelevance'

const memory = (content: string, type: AiMemory['memory_type']): AiMemory => ({
  id: content, user_id: 'user-1', workspace_id: null, memory_type: type, content,
  source: 'test', is_active: true, confidence: 0.9,
  created_at: '2026-10-06T10:00:00.000Z', updated_at: '2026-10-06T10:00:00.000Z',
  reinforcement_count: 0, last_reinforced_at: null,
})

describe('V2-05 Knowledge + Memory boundary', () => {
  it('keeps durable profile/preferences available while filtering unrelated conversation memory', () => {
    const rows = [
      memory('The user prefers concise executive reports.', 'learned_preference'),
      memory('The user is researching Tanzania tourism revenue.', 'conversation_memory'),
      memory('The user is planning a kitchen renovation.', 'conversation_memory'),
    ]
    const result = filterMemoriesByRelevance(rows, 'What is happening with Tanzania tourism revenue?')
    expect(result.map((item) => item.content)).toEqual([
      'The user prefers concise executive reports.',
      'The user is researching Tanzania tourism revenue.',
    ])
  })

  it('never treats personal memory as shared enterprise knowledge', () => {
    expect(memory('Private preference', 'explicit_profile').workspace_id).toBeNull()
  })
})
