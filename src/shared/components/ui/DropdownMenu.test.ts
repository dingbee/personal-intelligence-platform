import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DropdownMenu } from '@/shared/components/ui/DropdownMenu'

afterEach(cleanup)

function openMenu(...props: Parameters<typeof DropdownMenu>) {
  render(createElement(DropdownMenu, ...props))
  fireEvent.click(screen.getByRole('button'))
  return screen.getByRole('menu')
}

describe('DropdownMenu', () => {
  it('defaults to trigger-anchored absolute positioning (unchanged for every existing consumer)', () => {
    const panel = openMenu({ trigger: 'Open', children: 'content' })
    expect(panel.className).toContain('absolute')
    expect(panel.className).toContain('right-0')
    expect(panel.className).not.toContain('fixed')
    expect(panel.className).toContain('w-40')
  })

  it('applies a custom panelClassName in the default (non-responsive) mode exactly as given', () => {
    const panel = openMenu({ trigger: 'Open', children: 'content', panelClassName: 'w-64' })
    expect(panel.className).toContain('w-64')
  })

  it('BUG-002: responsiveOnMobile anchors the panel to the viewport (fixed inset-x-4) below md, reverting to trigger-anchored absolute at md and up', () => {
    const panel = openMenu({ trigger: 'Open', children: 'content', responsiveOnMobile: true, panelClassName: 'md:w-80' })
    // Mobile (unprefixed): viewport-anchored, not trigger-anchored.
    expect(panel.className).toContain('fixed')
    expect(panel.className).toContain('inset-x-4')
    // Desktop (md:-prefixed): the original trigger-anchored behavior, unchanged.
    expect(panel.className).toContain('md:absolute')
    expect(panel.className).toContain('md:right-0')
    expect(panel.className).toContain('md:w-80')
    // Never both `fixed` and unprefixed `absolute`/`right-0` at once — that
    // would be the exact conflicting-positioning bug this fixes.
    expect(panel.className).not.toMatch(/(?<!md:)\babsolute\b/)
    expect(panel.className).not.toMatch(/(?<!md:)\bright-0\b/)
  })

  it('every other DropdownMenu consumer is unaffected by the responsiveOnMobile option existing — omitting it keeps the original markup', () => {
    const withoutOption = openMenu({ trigger: 'Open', children: 'content', panelClassName: 'w-80' })
    expect(withoutOption.className).toBe('absolute right-0 z-10 mt-1 w-80 overflow-hidden rounded-panel border border-[var(--color-border)] bg-[var(--surface-floating)] py-1 shadow-floating')
  })
})
