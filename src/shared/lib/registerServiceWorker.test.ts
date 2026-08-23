import { describe, expect, it, vi } from 'vitest'
import { registerServiceWorker } from './registerServiceWorker'

describe('registerServiceWorker', () => {
  it('does nothing when service workers are unavailable', () => {
    const original = navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined })
    expect(() => registerServiceWorker()).not.toThrow()
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: original })
  })

  it('registers the root-scoped service worker after load', async () => {
    const register = vi.fn().mockResolvedValue({})
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } })

    registerServiceWorker()
    window.dispatchEvent(new Event('load'))
    await Promise.resolve()

    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
  })
})
