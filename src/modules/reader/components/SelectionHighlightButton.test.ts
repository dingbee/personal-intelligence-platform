import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, createRef } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SelectionHighlightButton } from '@/modules/reader/components/SelectionHighlightButton'

/**
 * V1 Launch Hardening, Workstream 3 — Reader had a "Highlight" affordance
 * on text selection but no way to copy the selection to the clipboard
 * (only native OS long-press copy as a fallback). This pins the addition
 * of a "Copy" control alongside "Highlight", using the same pattern
 * established in ActionsPage.tsx/MessageBubble.tsx, without changing
 * Highlight's own existing behavior.
 */

function makeSelection(text: string, container: HTMLElement) {
  const range = {
    commonAncestorContainer: container,
    getBoundingClientRect: () => ({ top: 100, left: 50, width: 80, height: 20, bottom: 120, right: 130, x: 50, y: 100, toJSON: () => ({}) }),
  } as unknown as Range
  return {
    isCollapsed: false,
    rangeCount: 1,
    toString: () => text,
    getRangeAt: () => range,
    removeAllRanges: vi.fn(),
  } as unknown as Selection
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SelectionHighlightButton — Copy affordance (V1 Launch Hardening)', () => {
  let writeText: ReturnType<typeof vi.fn>
  let container: HTMLDivElement

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  function renderWithSelection(text = 'a selected quote') {
    const containerRef = createRef<HTMLElement | null>()
    ;(containerRef as { current: HTMLElement }).current = container
    const onHighlight = vi.fn()
    render(createElement(SelectionHighlightButton, { containerRef, onHighlight }))

    const selection = makeSelection(text, container)
    vi.spyOn(window, 'getSelection').mockReturnValue(selection)
    act(() => {
      document.dispatchEvent(new Event('selectionchange'))
    })

    return { onHighlight, selection }
  }

  it('renders both Highlight and Copy controls over a real selection', () => {
    renderWithSelection()

    expect(screen.getByText('Highlight')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Copy selection' })).not.toBeNull()
  })

  it('copies the selected text to the clipboard and shows a "Copied" flash, without triggering onHighlight', async () => {
    const { onHighlight } = renderWithSelection('the selected quote')

    fireEvent.click(screen.getByRole('button', { name: 'Copy selection' }))

    expect(await screen.findByText('Copied')).not.toBeNull()
    expect(writeText).toHaveBeenCalledWith('the selected quote')
    expect(onHighlight).not.toHaveBeenCalled()
  })

  it('preserves existing Highlight behavior unchanged: calls onHighlight and clears the selection', () => {
    const { onHighlight } = renderWithSelection('quote to highlight')

    fireEvent.click(screen.getByText('Highlight'))

    expect(onHighlight).toHaveBeenCalledWith('quote to highlight')
    expect(screen.queryByText('Highlight')).toBeNull()
  })

  it('fails gracefully when the clipboard write rejects, without throwing or getting stuck on "Copied"', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'))
    renderWithSelection()

    fireEvent.click(screen.getByRole('button', { name: 'Copy selection' }))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))

    expect(screen.queryByText('Copied')).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy selection' })).not.toBeNull()
  })

  it('renders nothing when there is no active selection', () => {
    const containerRef = createRef<HTMLElement | null>()
    ;(containerRef as { current: HTMLElement }).current = container
    const { container: root } = render(createElement(SelectionHighlightButton, { containerRef, onHighlight: vi.fn() }))

    expect(root.firstChild).toBeNull()
  })
})
