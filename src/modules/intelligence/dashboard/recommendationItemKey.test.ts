import { describe, expect, it } from 'vitest'
import { recommendationItemKey } from '@/modules/intelligence/dashboard/recommendationItemKey'
import type { Command } from '@/modules/commands/types'

function testCommand(id: string): Command {
  return { id, title: id, icon: '•', category: 'navigation', execute: () => {} }
}

describe('recommendationItemKey', () => {
  it('combines category and command id into a stable, unique key', () => {
    expect(recommendationItemKey({ category: 'continue', command: testCommand('conversation-resume-conv-1') })).toBe(
      'continue:conversation-resume-conv-1',
    )
  })

  it('produces different keys for the same command id under different categories', () => {
    const command = testCommand('nav-library')
    expect(recommendationItemKey({ category: 'organize', command })).not.toBe(recommendationItemKey({ category: 'explore', command }))
  })
})
