import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { appConfig } from '@/app/appConfig'

/**
 * Post-10/10 Phase 4 (Application & PWA Readiness). The manifest is a static
 * public/ asset, not imported code, so it's validated by reading it off disk
 * the same way a browser would fetch it — this is the only way to catch a
 * malformed/incomplete manifest before it reaches an install prompt.
 */
const manifestPath = path.resolve(__dirname, '../../public/manifest.webmanifest')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as {
  name: string
  short_name: string
  start_url: string
  scope: string
  display: string
  theme_color: string
  background_color: string
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>
}

describe('manifest.webmanifest', () => {
  it('is valid, parseable JSON with the required installability fields present', () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.display).toBeTruthy()
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  it('uses the approved ARRIYIA identity, matching the single-source-of-truth appConfig', () => {
    expect(manifest.short_name).toBe(appConfig.productName)
    expect(manifest.name).toContain(appConfig.productName)
    expect(manifest.name).toContain(appConfig.productSubtitle)
  })

  it('does not hardcode a production origin — start_url and scope stay root-relative', () => {
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/')).toBe(true)
      expect(icon.src).not.toMatch(/^https?:\/\//)
    }
  })

  it('sets standalone display mode for an app-like installed experience', () => {
    expect(manifest.display).toBe('standalone')
  })

  it('has consistent theme/background colors matching the app dark-canvas token', () => {
    expect(manifest.theme_color).toBe('#1c1917')
    expect(manifest.background_color).toBe('#1c1917')
  })

  it('declares a real PNG icon at 192x192 and 512x512, the two sizes Chromium requires for installability', () => {
    const pngIcons = manifest.icons.filter((icon) => icon.type === 'image/png')
    const sizes = pngIcons.map((icon) => icon.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  it('has no maskable icon declared, since no safe-zone-padded artwork has been verified yet', () => {
    const maskable = manifest.icons.filter((icon) => icon.purpose === 'maskable')
    expect(maskable).toHaveLength(0)
  })
})
