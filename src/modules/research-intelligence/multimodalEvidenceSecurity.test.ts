import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Multimodal Evidence Integration sprint — static security guard,
 * mirroring src/shared/provenance/security.test.ts's own real-grep
 * discipline rather than a doc comment: gatherEvidence.ts (Research
 * Intelligence's only evidence-acquisition mechanism, see that file's
 * own doc comment) must never gain a second, direct path to the assets
 * table. It must reuse retrieveAssetContext.ts exactly as it reuses
 * retrieveContext.ts/retrieveNoteContext.ts — never query Supabase
 * itself, and never accept a caller-supplied asset id to look up
 * directly. If a future edit to this file introduces its own
 * `supabase.from('assets')`/`.rpc('match_assets')` call, that would be
 * exactly the "client-trusted asset ID" / "new path around
 * authorization" risk the sprint brief's Security section (§3) warns
 * against — this test fails loudly instead of that risk landing silently.
 */
describe('gatherEvidence: no independent asset/data access (security)', () => {
  it('gatherEvidence.ts never imports the Supabase client or queries assets/match_assets directly', () => {
    const content = readFileSync(join(__dirname, 'gatherEvidence.ts'), 'utf8')
    expect(content).not.toMatch(/from ['"]@\/shared\/lib\/supabase['"]/)
    expect(content).not.toMatch(/supabase\.(from|rpc)\(/)
    expect(content).not.toMatch(/match_assets/)
    expect(content).not.toMatch(/\.from\(['"]assets['"]\)/)
  })

  it('gatherEvidence.ts only ever imports retrieveAssetContext through the real, existing chat-grounding module — never a bespoke asset-fetching helper', () => {
    const content = readFileSync(join(__dirname, 'gatherEvidence.ts'), 'utf8')
    expect(content).toMatch(/from ['"]@\/modules\/ai\/orchestration\/retrieveAssetContext['"]/)
  })
})
