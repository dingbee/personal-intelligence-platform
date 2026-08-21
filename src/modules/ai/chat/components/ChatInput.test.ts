import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

/**
 * LOCKED DECISION — Enter always inserts a newline (desktop and mobile
 * alike); only Ctrl/Cmd+Enter or the Send button submits. Preserves every
 * other pre-existing behavior (disabled/submitting state, only clearing
 * the draft on a confirmed send, keeping the draft on a failed send).
 */

import { ChatInput } from '@/modules/ai/chat/components/ChatInput'

function renderInput(onSend = vi.fn().mockResolvedValue(true), disabled = false) {
  render(createElement(ChatInput, { disabled, onSend }))
  return { onSend }
}

afterEach(cleanup)

describe('ChatInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('plain Enter inserts a newline and does not submit', () => {
    const { onSend } = renderInput()
    const textarea = screen.getByPlaceholderText('Ask about your library...') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: 'line one' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('Shift+Enter inserts a newline and does not submit', () => {
    const { onSend } = renderInput()
    const textarea = screen.getByPlaceholderText('Ask about your library...') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: 'line one' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('Ctrl+Enter submits on desktop', async () => {
    const { onSend } = renderInput()
    const textarea = screen.getByPlaceholderText('Ask about your library...') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: 'ctrl send' } })
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })
    await Promise.resolve()

    expect(onSend).toHaveBeenCalledWith('ctrl send')
  })

  it('Cmd+Enter (metaKey) submits on desktop', async () => {
    const { onSend } = renderInput()
    const textarea = screen.getByPlaceholderText('Ask about your library...') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: 'cmd send' } })
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true })
    await Promise.resolve()

    expect(onSend).toHaveBeenCalledWith('cmd send')
  })

  it('the Send button submits the current text', async () => {
    const { onSend } = renderInput()
    const textarea = screen.getByPlaceholderText('Ask about your library...') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: 'via button' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await Promise.resolve()

    expect(onSend).toHaveBeenCalledWith('via button')
  })

  it('a multiline message composed with plain Enter is sent intact via the Send button', async () => {
    const { onSend } = renderInput()
    const textarea = screen.getByPlaceholderText('Ask about your library...') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: 'line one\nline two\nline three' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await Promise.resolve()

    expect(onSend).toHaveBeenCalledWith('line one\nline two\nline three')
  })

  it('clears the draft after a confirmed send', async () => {
    render(createElement(ChatInput, { disabled: false, onSend: vi.fn().mockResolvedValue(true) }))
    const textarea = () => screen.getByPlaceholderText('Ask about your library...') as HTMLTextAreaElement

    fireEvent.change(textarea(), { target: { value: 'ok' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(textarea().value).toBe(''))
  })

  it('keeps the draft in place after a failed send', async () => {
    render(createElement(ChatInput, { disabled: false, onSend: vi.fn().mockResolvedValue(false) }))
    const textarea = () => screen.getByPlaceholderText('Ask about your library...') as HTMLTextAreaElement

    fireEvent.change(textarea(), { target: { value: 'still here' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(textarea().value).toBe('still here'))
  })

  it('does not submit an empty or whitespace-only draft, even via Ctrl+Enter', () => {
    const { onSend } = renderInput()
    const textarea = screen.getByPlaceholderText('Ask about your library...') as HTMLTextAreaElement

    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables the Send button while disabled or while submitting', () => {
    renderInput(vi.fn().mockResolvedValue(true), true)
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('the composer textarea remains a multiline element (rows=1 with wrapping, not a single-line input)', () => {
    renderInput()
    const textarea = screen.getByPlaceholderText('Ask about your library...') as HTMLTextAreaElement
    expect(textarea.tagName).toBe('TEXTAREA')
  })
})
