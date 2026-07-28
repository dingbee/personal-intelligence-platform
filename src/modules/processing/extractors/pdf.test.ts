import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

/**
 * Regression test for the pdfjs-dist runtime incompatibility: 5.5.207 and
 * every later release through at least 6.1.200 call
 * `Map.prototype.getOrInsertComputed` in their published `build/pdf.mjs` —
 * a very new JS Map method this app's runtime doesn't support, so the very
 * first `getDocument()` call throws before any PDF is parsed. Running the
 * real pdfjs-dist worker pipeline isn't reproducible in this Node test
 * environment (jsdom lacks DOMMatrix/a Worker constructor, and pdfjs-dist's
 * Node "fake worker" fallback itself depends on newer runtime APIs than
 * this sandbox's Node has), so this checks the thing that actually broke —
 * the installed build artifact — directly, rather than simulating a worker
 * environment real browsers don't need. See pdf.ts's header comment.
 */
describe('pdfjs-dist runtime compatibility', () => {
  it('is pinned to a version whose build does not reference Map.prototype.getOrInsertComputed', () => {
    const require = createRequire(import.meta.url)
    const pkg = require('pdfjs-dist/package.json') as { version: string }
    const pdfMjsPath = require.resolve('pdfjs-dist/build/pdf.mjs')
    const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')

    const pdfMjs = readFileSync(pdfMjsPath, 'utf8')
    const worker = readFileSync(workerPath, 'utf8')

    expect(pdfMjs).not.toContain('getOrInsertComputed')
    expect(worker).not.toContain('getOrInsertComputed')
    // Locks the version too, so a future `npm update` that silently drifts
    // past the known-bad 5.5.0 boundary fails loudly here instead of only
    // in production.
    expect(pkg.version).toBe('5.4.624')
  })
})
