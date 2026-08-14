import { describe, expect, it } from 'vitest'
import { getCapability, isCapabilityAvailable, listCapabilities } from '@/modules/execution-foundation/api/capabilityRegistry'

describe('capabilityRegistry', () => {
  it('lists at least the three safe internal capabilities and the five external placeholders', () => {
    const ids = listCapabilities().map((c) => c.id)
    expect(ids).toContain('save_action_to_notes')
    expect(ids).toContain('add_action_as_workspace_objective')
    expect(ids).toContain('link_action_to_workspace_objective')
    expect(ids).toContain('send_email')
    expect(ids).toContain('create_calendar_event')
    expect(ids).toContain('send_message')
    expect(ids).toContain('external_api_call')
    expect(ids).toContain('financial_transaction')
  })

  it('marks the three safe internal capabilities available with no external side effects', () => {
    for (const id of ['save_action_to_notes', 'add_action_as_workspace_objective', 'link_action_to_workspace_objective']) {
      const cap = getCapability(id)!
      expect(cap.availability).toBe('available')
      expect(cap.externalSideEffects).toBe(false)
    }
  })

  it('marks every external-side-effect capability unavailable with an explanatory reason', () => {
    for (const id of ['send_email', 'create_calendar_event', 'send_message', 'external_api_call', 'financial_transaction']) {
      const cap = getCapability(id)!
      expect(cap.availability).toBe('unavailable')
      expect(cap.externalSideEffects).toBe(true)
      expect(cap.unavailableReason).toBeTruthy()
    }
  })

  it('isCapabilityAvailable is true only for the safe internal capabilities', () => {
    expect(isCapabilityAvailable('save_action_to_notes')).toBe(true)
    expect(isCapabilityAvailable('send_email')).toBe(false)
  })

  it('isCapabilityAvailable is false for an unregistered id, never throwing', () => {
    expect(isCapabilityAvailable('not_a_real_capability')).toBe(false)
    expect(getCapability('not_a_real_capability')).toBeUndefined()
  })
})
