import { describe, expect, it } from 'vitest'
import { compileVerticalRegistrationToNoVARuntimeManifest } from './manifest'
import type { VerticalRegistration } from '../vertical-intelligence/types'

const fixture: VerticalRegistration = {
  verticalId: 'example-vertical',
  displayName: 'Example Vertical',
  contractVersion: '1.0.0',
  capabilities: ['account.read'],
  entities: [{ id: 'account', label: 'Account', description: 'Example account.' }],
  signals: [{ id: 'account-updated', label: 'Account updated', description: 'Account changed.', entityIds: ['account'] }],
  tools: [{ id: 'account-read', description: 'Read account.', requiresApproval: false }],
  agents: [{
    id: 'account-agent',
    name: 'Account Agent',
    description: 'Example agent.',
    intelligenceKind: 'custom',
    capabilities: ['account.read'],
    allowedTools: ['account-read'],
    context: { entityIds: ['account'], signalIds: ['account-updated'] },
    autonomy: 'inform',
  }],
  governanceRequirements: { approvalForConsequentialActions: true },
  executionAuthority: 'nova-core',
}

describe('NoVA runtime manifest compiler', () => {
  it('compiles generic vertical metadata without product ownership', () => {
    const manifest = compileVerticalRegistrationToNoVARuntimeManifest(fixture)
    expect(manifest.manifestVersion).toBe('1.0.0')
    expect(manifest.vertical.id).toBe('example-vertical')
    expect(manifest.vertical.executionAuthority).toBe('nova-core')
    expect(manifest.tools[0]).toMatchObject({ id: 'account-read', verticalId: 'example-vertical', requiresApproval: false })
    expect(manifest.agents[0]).toMatchObject({ id: 'account-agent', verticalId: 'example-vertical', toolIds: ['account-read'], autonomyCeiling: 'inform' })
    expect(manifest.governance.approvalForConsequentialActions).toBe(true)
  })

  it('rejects references to unknown contract entities, signals or tools', () => {
    expect(() => compileVerticalRegistrationToNoVARuntimeManifest({
      ...fixture, agents: [{ ...fixture.agents[0], allowedTools: ['missing-tool'] }],
    })).toThrow('references unknown tool')
    expect(() => compileVerticalRegistrationToNoVARuntimeManifest({
      ...fixture, agents: [{ ...fixture.agents[0], context: { entityIds: ['missing-entity'], signalIds: [] } }],
    })).toThrow('references unknown entity')
    expect(() => compileVerticalRegistrationToNoVARuntimeManifest({
      ...fixture, signals: [{ ...fixture.signals[0], entityIds: ['missing-entity'] }],
    })).toThrow('references unknown entity')
  })

  it('rejects invalid execution authority and ungated consequential actions', () => {
    expect(() => compileVerticalRegistrationToNoVARuntimeManifest({
      ...fixture, executionAuthority: 'arriyia' as unknown as 'nova-core',
    })).toThrow('execution authority must remain nova-core')
    expect(() => compileVerticalRegistrationToNoVARuntimeManifest({
      ...fixture, governanceRequirements: { approvalForConsequentialActions: false as true },
    })).toThrow('must remain approval-gated')
  })
})
