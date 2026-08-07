import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
// Registers the real chat providers (anthropic/openai/google) into
// providerRegistry as a side effect — normally done once by app/App.tsx.
// providerRegistry is a module-level singleton, not a param ProviderSelect
// receives, so a render test needs it populated exactly like production.
import '@/modules/core/modules/coreModule'

const { useProviderAvailabilityMock, useProviderOverridesMock } = vi.hoisted(() => ({
  useProviderAvailabilityMock: vi.fn(),
  useProviderOverridesMock: vi.fn(),
}))
vi.mock('@/modules/ai/providers/useProviderAvailability', () => ({ useProviderAvailability: useProviderAvailabilityMock }))
vi.mock('@/modules/ai/providers/useProviderOverrides', () => ({ useProviderOverrides: useProviderOverridesMock }))

import { ProviderSelect } from '@/modules/ai/chat/components/ProviderSelect'

afterEach(cleanup)

describe('ProviderSelect', () => {
  it('renders "Auto (Recommended)" selected when value is null', () => {
    useProviderAvailabilityMock.mockReturnValue({ data: { anthropic: true, openai: true, google: true } })
    useProviderOverridesMock.mockReturnValue({ data: {} })

    render(createElement(ProviderSelect, { value: null, onChange: vi.fn() }))

    const select = screen.getByRole('combobox', { name: 'AI provider' }) as HTMLSelectElement
    expect(select.value).toBe('')
    expect(screen.getByText('Auto (Recommended)')).toBeTruthy()
  })

  it('calls onChange with null when the user picks Auto (Recommended)', () => {
    useProviderAvailabilityMock.mockReturnValue({ data: { anthropic: true, openai: true, google: true } })
    useProviderOverridesMock.mockReturnValue({ data: {} })
    const onChange = vi.fn()

    render(createElement(ProviderSelect, { value: 'openai', onChange }))

    const select = screen.getByRole('combobox', { name: 'AI provider' })
    fireEvent.change(select, { target: { value: '' } })

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('calls onChange with the provider id when a real provider is picked', () => {
    useProviderAvailabilityMock.mockReturnValue({ data: { anthropic: true, openai: true, google: true } })
    useProviderOverridesMock.mockReturnValue({ data: {} })
    const onChange = vi.fn()

    render(createElement(ProviderSelect, { value: null, onChange }))

    const select = screen.getByRole('combobox', { name: 'AI provider' })
    fireEvent.change(select, { target: { value: 'anthropic' } })

    expect(onChange).toHaveBeenCalledWith('anthropic')
  })

  it('shows a disabled "(unavailable)" option for a stored preference that is no longer available, without dropping Auto', () => {
    useProviderAvailabilityMock.mockReturnValue({ data: { anthropic: false, openai: true, google: true } })
    useProviderOverridesMock.mockReturnValue({ data: {} })

    render(createElement(ProviderSelect, { value: 'anthropic', onChange: vi.fn() }))

    expect(screen.getByText('Auto (Recommended)')).toBeTruthy()
    expect(screen.getByText(/unavailable/)).toBeTruthy()
  })
})
