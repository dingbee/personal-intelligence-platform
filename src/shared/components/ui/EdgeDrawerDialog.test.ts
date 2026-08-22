import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, render, screen } from '@testing-library/react'

// jsdom does not implement <dialog>'s showModal()/close() — same polyfill
// pattern already established in AdminPlansPage.test.ts/
// AdminFoundingProPage.test.ts, just enough for the open/close effect
// below to run without a runtime crash.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
}

import { EdgeDrawerDialog, type EdgeDrawerDialogProps } from '@/shared/components/ui/EdgeDrawerDialog'

afterEach(cleanup)

function drawerElement(props: Omit<EdgeDrawerDialogProps, 'children'>) {
  return createElement(EdgeDrawerDialog, props as EdgeDrawerDialogProps, 'content')
}

function renderDrawer(props: Omit<EdgeDrawerDialogProps, 'children'>) {
  return render(drawerElement(props))
}

/**
 * Mobile navigation drawer viewport fix — regression coverage for the
 * production bug where the underlying Chat composer showed through
 * beneath the open drawer: the drawer's own box didn't reach the real
 * bottom of the visible mobile viewport. jsdom can't compute real CSS
 * layout (dvh, flex sizing), so this asserts the actual fix — dynamic
 * viewport sizing, full backdrop coverage, and internal scrollability —
 * is present in the rendered output, shared by every consumer
 * (MobileNavDrawer, MobileConversationDrawer, MobileCollectionsDrawer).
 */
describe('EdgeDrawerDialog', () => {
  it('sizes the drawer with a dynamic-viewport-height fallback so it always reaches the true bottom of the visible screen, not just the large/layout viewport', () => {
    renderDrawer({ open: true, onClose: vi.fn(), ariaLabel: 'Test drawer' })
    const dialog = screen.getByRole('dialog', { name: 'Test drawer' })
    expect(dialog.className).toContain('h-full')
    expect(dialog.className).toContain('h-dvh')
    // fixed + inset-y-0 so it's viewport-anchored, not scoped to some
    // padded ancestor the way the desktop Chat workspace bug was.
    expect(dialog.className).toContain('fixed')
    expect(dialog.className).toContain('inset-y-0')
  })

  it('lets its panel content scroll internally if the menu exceeds viewport height, instead of silently clipping items', () => {
    renderDrawer({ open: true, onClose: vi.fn(), ariaLabel: 'Test drawer' })
    const dialog = screen.getByRole('dialog', { name: 'Test drawer' })
    const panel = dialog.firstElementChild as HTMLElement
    expect(panel.className).toContain('overflow-y-auto')
  })

  it('clears the bottom system-inset (home indicator/gesture bar) on notched devices', () => {
    renderDrawer({ open: true, onClose: vi.fn(), ariaLabel: 'Test drawer' })
    const dialog = screen.getByRole('dialog', { name: 'Test drawer' })
    const panel = dialog.firstElementChild as HTMLElement
    expect(panel.className).toContain('env(safe-area-inset-bottom)')
  })

  it('opens via showModal (native top-layer — always renders above ordinary in-flow content like the composer, no z-index needed) and closes via close()', () => {
    const onClose = vi.fn()
    const { rerender } = renderDrawer({ open: false, onClose, ariaLabel: 'Test drawer' })
    const dialog = screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement
    expect(dialog.hasAttribute('open')).toBe(false)

    rerender(drawerElement({ open: true, onClose, ariaLabel: 'Test drawer' }))
    expect(dialog.hasAttribute('open')).toBe(true)

    rerender(drawerElement({ open: false, onClose, ariaLabel: 'Test drawer' }))
    expect(dialog.hasAttribute('open')).toBe(false)
  })
})
