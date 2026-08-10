import { describe, expect, it, vi } from 'vitest'

const { useHasFeatureMock } = vi.hoisted(() => ({ useHasFeatureMock: vi.fn() }))
vi.mock('@/modules/plans/hooks/useHasFeature', () => ({ useHasFeature: useHasFeatureMock }))

import { useHasProIntelligence } from '@/modules/plans/hooks/useHasProIntelligence'

/**
 * Phase P0 Pro Intelligence Foundation — useHasProIntelligence is a thin,
 * hardcoded-key wrapper over useHasFeature; the only behavior worth
 * testing is that it always asks for the 'pro_intelligence' key and
 * passes the underlying query result straight through, so Founding
 * Pro/Pro parity and server resolution stay entirely useHasFeature's
 * concern (already tested via plans.test.ts's hasFeature coverage).
 */
describe('useHasProIntelligence', () => {
  it("resolves entitlement via useHasFeature('pro_intelligence')", () => {
    useHasFeatureMock.mockReturnValue({ data: true, isLoading: false })

    const result = useHasProIntelligence()

    expect(useHasFeatureMock).toHaveBeenCalledWith('pro_intelligence')
    expect(result).toEqual({ data: true, isLoading: false })
  })

  it('passes through a false/denied result unchanged', () => {
    useHasFeatureMock.mockReturnValue({ data: false, isLoading: false })

    expect(useHasProIntelligence()).toEqual({ data: false, isLoading: false })
  })

  it('passes through the loading state unchanged', () => {
    useHasFeatureMock.mockReturnValue({ data: undefined, isLoading: true })

    expect(useHasProIntelligence()).toEqual({ data: undefined, isLoading: true })
  })
})
