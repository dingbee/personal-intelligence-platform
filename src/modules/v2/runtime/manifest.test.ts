import { describe, expect, it } from 'vitest'
import { compilePluginContractToNoVARuntimeManifest } from './manifest'
import type { NoVAPluginContract } from './manifest'

const fixture: NoVAPluginContract = {
  pluginId: 'example-plugin',
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
    const manifest = compilePluginContractToNoVARuntimeManifest(fixture)
    expect(manifest.manifestVersion).toBe('1.0.0')
    expect(manifest.plugin.id).toBe('example-plugin')
    expect(manifest.plugin.executionAuthority).toBe('nova-core')
    expect(manifest.tools[0]).toMatchObject({ id: 'account-read', pluginId: 'example-plugin', requiresApproval: false })
    expect(manifest.agents[0]).toMatchObject({ id: 'account-agent', pluginId: 'example-plugin', toolIds: ['account-read'], autonomyCeiling: 'inform' })
    expect(manifest.governance.approvalForConsequentialActions).toBe(true)
  })

  it('rejects references to unknown contract entities, signals or tools', () => {
    expect(() => compilePluginContractToNoVARuntimeManifest({
      ...fixture, agents: [{ ...fixture.agents[0], allowedTools: ['missing-tool'] } as NoVAPluginContract['agents'][number]],
    })).toThrow('references unknown tool')
    expect(() => compilePluginContractToNoVARuntimeManifest({
      ...fixture, agents: [{ ...fixture.agents[0], context: { entityIds: ['missing-entity'], signalIds: [] } } as NoVAPluginContract['agents'][number]],
    })).toThrow('references unknown entity')
    expect(() => compilePluginContractToNoVARuntimeManifest({
      ...fixture, signals: [{ ...fixture.signals[0], entityIds: ['missing-entity'] } as NoVAPluginContract['signals'][number]],
    })).toThrow('references unknown entity')
  })

  it('rejects invalid execution authority and ungated consequential actions', () => {
    expect(() => compilePluginContractToNoVARuntimeManifest({
      ...fixture, executionAuthority: 'arriyia' as unknown as 'nova-core',
    })).toThrow('execution authority must remain nova-core')
    expect(() => compilePluginContractToNoVARuntimeManifest({
      ...fixture, governanceRequirements: { approvalForConsequentialActions: false as true },
    })).toThrow('must remain approval-gated')
  })
})
