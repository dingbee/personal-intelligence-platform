import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

/**
 * V1 Launch Hardening, Workstream 3 — Chat had no copy affordance for AI
 * responses at all (only "Save to Notes"), unlike the Actions module's
 * explicit "Copy action" button. This pins the fix: a Copy control on
 * assistant messages using the same ActionsPage-established pattern
 * (copyText + a "Copied" flash), absent on user messages and on the
 * structured artifact-preview branch, and tolerant of a clipboard failure.
 */

function assistantMessage(content = 'Here is the answer.') {
  return { role: 'assistant' as const, content, context_chunk_ids: [], id: 'm1' }
}

function userMessage(content = 'What is the answer?') {
  return { role: 'user' as const, content, context_chunk_ids: [], id: 'm2' }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('MessageBubble — copy affordance (V1 Launch Hardening)', () => {
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
  })

  it('renders a Copy button on an assistant message and copies its content on click', async () => {
    const { MessageBubble } = await import('@/modules/ai/chat/components/MessageBubble')
    render(createElement(MessageBubble, { message: assistantMessage('The answer is 42.') }))

    fireEvent.click(screen.getByRole('button', { name: 'Copy response' }))

    expect(await screen.findByText('Copied')).not.toBeNull()
    expect(writeText).toHaveBeenCalledWith('The answer is 42.')
  })

  it('reverts from "Copied" back to "Copy" after the flash timeout', async () => {
    const { MessageBubble } = await import('@/modules/ai/chat/components/MessageBubble')
    render(createElement(MessageBubble, { message: assistantMessage() }))

    fireEvent.click(screen.getByRole('button', { name: 'Copy response' }))
    await screen.findByText('Copied')

    await vi.waitFor(() => expect(screen.queryByText('Copied')).toBeNull(), { timeout: 2500 })
    expect(screen.getByRole('button', { name: 'Copy response' })).not.toBeNull()
  }, 5000)

  it('does not render a Copy button on a user message', async () => {
    const { MessageBubble } = await import('@/modules/ai/chat/components/MessageBubble')
    render(createElement(MessageBubble, { message: userMessage() }))

    expect(screen.queryByRole('button', { name: 'Copy response' })).toBeNull()
  })

  it('does not render a Copy button when a structured artifact preview is shown instead', async () => {
    const { MessageBubble } = await import('@/modules/ai/chat/components/MessageBubble')
    render(
      createElement(MessageBubble, {
        message: assistantMessage(),
        artifactPreview: { kind: 'note', title: 'Preview', summary: 'x' } as never,
      }),
    )

    expect(screen.queryByRole('button', { name: 'Copy response' })).toBeNull()
  })

  it('fails gracefully when the clipboard write rejects, without throwing or getting stuck on "Copied"', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    const { MessageBubble } = await import('@/modules/ai/chat/components/MessageBubble')
    render(createElement(MessageBubble, { message: assistantMessage() }))

    fireEvent.click(screen.getByRole('button', { name: 'Copy response' }))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))

    expect(screen.queryByText('Copied')).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy response' })).not.toBeNull()
  })

  it('still renders "Save to Notes" alongside Copy, unaffected by the new control', async () => {
    const { MessageBubble } = await import('@/modules/ai/chat/components/MessageBubble')
    const onSave = vi.fn()
    render(createElement(MessageBubble, { message: assistantMessage(), onSave, saved: false, saving: false }))

    expect(screen.getByRole('button', { name: 'Copy response' })).not.toBeNull()
    expect(screen.getByText('Save to Notes')).not.toBeNull()
  })
})
