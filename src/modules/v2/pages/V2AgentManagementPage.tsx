import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useV2Space } from '../workspace/SpaceContext'
import {
  createV2Agent,
  getV2AgentVersions,
  listV2Agents,
  saveV2AgentVersion,
  setV2AgentStatus,
  validateV2Agent,
  type V2Agent,
  type V2AgentDefinition,
  type V2AgentStatus,
} from '../agents/api/agentManagement'

const emptyDefinition = (): V2AgentDefinition => ({
  version: 1,
  systemPurpose: '',
  capabilities: [],
  toolIds: [],
  memoryScopes: ['workspace'],
  policyIds: [],
  autonomyCeiling: 'recommend',
})

const statusLabel: Record<V2AgentStatus, string> = {
  draft: 'Draft',
  validated: 'Validated',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

export function V2AgentManagementPage() {
  const { activeSpace } = useV2Space()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [definition, setDefinition] = useState<V2AgentDefinition>(() => emptyDefinition())
  const [capabilitiesText, setCapabilitiesText] = useState('')
  const [toolIdsText, setToolIdsText] = useState('')
  const [memoryScopesText, setMemoryScopesText] = useState('workspace')
  const [policyIdsText, setPolicyIdsText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const workspaceId = activeSpace?.kind === 'business' ? activeSpace.spaceId : null
  const canEdit = activeSpace?.kind === 'business'
    && (activeSpace.membershipRole === 'editor' || activeSpace.membershipRole === 'owner')
  const canActivate = activeSpace?.kind === 'business'
    && activeSpace.membershipRole === 'owner'

  const agentsQuery = useQuery({
    queryKey: ['v2-agents', workspaceId],
    queryFn: () => listV2Agents(workspaceId),
    enabled: Boolean(activeSpace),
  })

  const selectedAgent = useMemo(
    () => agentsQuery.data?.find((agent) => agent.id === selectedId) ?? agentsQuery.data?.[0] ?? null,
    [agentsQuery.data, selectedId],
  )

  const versionsQuery = useQuery({
    queryKey: ['v2-agent-versions', selectedAgent?.id],
    queryFn: () => getV2AgentVersions(selectedAgent!.id),
    enabled: Boolean(selectedAgent),
  })

  useEffect(() => {
    const latest = versionsQuery.data?.[0]
    if (!latest || !selectedAgent) return
    setDefinition(latest.definition)
    setCapabilitiesText(latest.definition.capabilities.join(', '))
    setToolIdsText(latest.definition.toolIds.join(', '))
    setMemoryScopesText(latest.definition.memoryScopes.join(', '))
    setPolicyIdsText(latest.definition.policyIds.join(', '))
  }, [selectedAgent?.id, versionsQuery.data])

  const createMutation = useMutation({
    mutationFn: () => createV2Agent({
      workspaceId: workspaceId!,
      name,
      slug,
      description,
    }),
    onSuccess: (agent) => {
      setSelectedId(agent.id)
      setName('')
      setSlug('')
      setDescription('')
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['v2-agents', workspaceId] })
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
  })

  const saveMutation = useMutation({
    mutationFn: () => saveV2AgentVersion(selectedAgent!.id, {
      ...definition,
      version: definition.version,
      capabilities: capabilitiesText.split(',').map((v) => v.trim()).filter(Boolean),
      toolIds: toolIdsText.split(',').map((v) => v.trim()).filter(Boolean),
      memoryScopes: memoryScopesText.split(',').map((v) => v.trim()).filter(Boolean),
      policyIds: policyIdsText.split(',').map((v) => v.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['v2-agent-versions', selectedAgent?.id] })
      void queryClient.invalidateQueries({ queryKey: ['v2-agents', workspaceId] })
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
  })

  const validateMutation = useMutation({
    mutationFn: () => validateV2Agent(selectedAgent!.id),
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['v2-agent-versions', selectedAgent?.id] })
      void queryClient.invalidateQueries({ queryKey: ['v2-agents', workspaceId] })
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
  })

  const statusMutation = useMutation({
    mutationFn: (status: V2AgentStatus) => setV2AgentStatus(selectedAgent!.id, status),
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['v2-agent-versions', selectedAgent?.id] })
      void queryClient.invalidateQueries({ queryKey: ['v2-agents', workspaceId] })
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
  })

  const loadVersion = (agent: V2Agent) => {
    setSelectedId(agent.id)
    const latest = versionsQuery.data?.[0]
    if (latest && latest.agentId === agent.id) {
      setDefinition(latest.definition)
      setCapabilitiesText(latest.definition.capabilities.join(', '))
      setToolIdsText(latest.definition.toolIds.join(', '))
      setMemoryScopesText(latest.definition.memoryScopes.join(', '))
      setPolicyIdsText(latest.definition.policyIds.join(', '))
    } else {
      setDefinition(emptyDefinition())
      setCapabilitiesText('')
      setToolIdsText('')
      setMemoryScopesText('workspace')
      setPolicyIdsText('')
    }
    setError(null)
  }

  return (
    <div className="min-h-full bg-[var(--surface-base)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">ARRIYIA V2</span>
                <span>AGENT CONTROL PLANE</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">Agent Management</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                Durable, Space-scoped agent definitions with governed versioning and lifecycle.
                NoVA Core remains the execution authority.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
              <div className="font-medium text-[var(--text-primary)]">{activeSpace?.name ?? 'No Space'}</div>
              <div className="text-xs text-[var(--text-secondary)]">{activeSpace?.kind === 'business' ? 'Business / Enterprise' : 'Personal / Pro'}</div>
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[var(--text-primary)]">Agents</h2>
                <p className="text-xs text-[var(--text-secondary)]">{agentsQuery.data?.length ?? 0} in this Space</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {(agentsQuery.data ?? []).map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => loadVersion(agent)}
                  className={`w-full rounded-2xl border p-3 text-left ${selectedAgent?.id === agent.id ? 'border-[var(--text-primary)] bg-[var(--surface-muted)]' : 'border-[var(--border-subtle)]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[var(--text-primary)]">{agent.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{statusLabel[agent.status]}</span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">v{agent.activeVersion ?? '—'} · {agent.slug}</div>
                </button>
              ))}
              {!agentsQuery.isLoading && (agentsQuery.data ?? []).length === 0 && (
                <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-secondary)]">
                  No agents yet. Create the first governed agent below.
                </p>
              )}
            </div>

            <form
              className="mt-5 space-y-3 border-t border-[var(--border-subtle)] pt-5"
              onSubmit={(event) => {
                event.preventDefault()
                if (!canEdit || !name.trim() || !slug.trim()) return
                createMutation.mutate()
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Create agent</div>
              <input className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="slug e.g. revenue-analyst" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
              <textarea className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="Purpose / description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              <button disabled={!canEdit || createMutation.isPending} className="w-full rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--surface-base)] disabled:opacity-40">
                {createMutation.isPending ? 'Creating…' : 'Create agent'}
              </button>
            </form>
          </aside>

          <main className="space-y-6">
            {!selectedAgent ? (
              <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">Define the agent</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Create an agent to begin. Definitions are persisted in the V2 control plane and never executed here.</p>
              </section>
            ) : (
              <>
                <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Agent</div>
                      <h2 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{selectedAgent.name}</h2>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedAgent.description || 'No description'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border px-3 py-1 text-xs">{statusLabel[selectedAgent.status]}</span>
                      {selectedAgent.status !== 'archived' && canEdit && (
                        <button type="button" onClick={() => statusMutation.mutate(selectedAgent.status === 'paused' ? 'draft' : 'paused')} className="rounded-xl border px-3 py-2 text-xs font-medium">
                          {selectedAgent.status === 'paused' ? 'Resume' : 'Pause'}
                        </button>
                      )}
                      {selectedAgent.status !== 'archived' && canActivate && (
                        <button type="button" onClick={() => statusMutation.mutate('active')} disabled={statusMutation.isPending} className="rounded-xl bg-[var(--text-primary)] px-3 py-2 text-xs font-medium text-[var(--surface-base)] disabled:opacity-40">
                          Activate
                        </button>
                      )}
                      {selectedAgent.status !== 'archived' && canEdit && (
                        <button type="button" onClick={() => statusMutation.mutate('archived')} className="rounded-xl border px-3 py-2 text-xs font-medium">
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
                  <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Definition editor</div>
                        <h3 className="mt-1 font-semibold text-[var(--text-primary)]">Next version</h3>
                      </div>
                      <span className="text-xs text-[var(--text-secondary)]">v{(versionsQuery.data?.[0]?.version ?? 0) + 1}</span>
                    </div>

                    <div className="mt-5 space-y-4">
                      <textarea
                        className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm"
                        rows={4}
                        placeholder="System purpose"
                        value={definition.systemPurpose}
                        onChange={(e) => setDefinition({ ...definition, systemPurpose: e.target.value })}
                      />
                      <input className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="Capabilities, comma separated" value={capabilitiesText} onChange={(e) => setCapabilitiesText(e.target.value)} />
                      <input className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="Tool IDs, comma separated" value={toolIdsText} onChange={(e) => setToolIdsText(e.target.value)} />
                      <input className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="Memory scopes, comma separated" value={memoryScopesText} onChange={(e) => setMemoryScopesText(e.target.value)} />
                      <input className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="Policy IDs, comma separated" value={policyIdsText} onChange={(e) => setPolicyIdsText(e.target.value)} />
                      <select className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" value={definition.autonomyCeiling} onChange={(e) => setDefinition({ ...definition, autonomyCeiling: e.target.value as V2AgentDefinition['autonomyCeiling'] })}>
                        <option value="inform">Inform — no action preparation</option>
                        <option value="recommend">Recommend — proposes governed next steps</option>
                        <option value="prepare">Prepare — prepares an action for approval</option>
                        <option value="bounded">Bounded — bounded execution when later authorized by policy</option>
                      </select>
                      <button type="button" disabled={!canEdit || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--surface-base)] disabled:opacity-40">
                        {saveMutation.isPending ? 'Saving version…' : 'Save new version'}
                      </button>
                    </div>
                  </article>

                  <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Version history</div>
                    <div className="mt-4 space-y-2">
                      {(versionsQuery.data ?? []).map((version) => (
                        <button
                          key={version.id}
                          type="button"
                          onClick={() => {
                            setDefinition(version.definition)
                            setCapabilitiesText(version.definition.capabilities.join(', '))
                            setToolIdsText(version.definition.toolIds.join(', '))
                            setMemoryScopesText(version.definition.memoryScopes.join(', '))
                            setPolicyIdsText(version.definition.policyIds.join(', '))
                          }}
                          className="w-full rounded-2xl border border-[var(--border-subtle)] p-3 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">Version {version.version}</span>
                            <span className="text-xs text-[var(--text-secondary)]">{version.status}</span>
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{version.definition.systemPurpose}</div>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={!canEdit || validateMutation.isPending}
                      onClick={() => validateMutation.mutate()}
                      className="mt-4 w-full rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-40"
                    >
                      {validateMutation.isPending ? 'Validating…' : 'Validate latest version'}
                    </button>
                  </article>
                </section>

                <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Execution boundary</div>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        V2 stores identity, definition, version, Space scope and governance references. It does not execute the agent.
                      </p>
                    </div>
                    <Link className="text-sm font-medium underline" to="/v2/workflows">Open Workflow Studio →</Link>
                  </div>
                </section>
              </>
            )}
          </main>
        </section>
      </div>
    </div>
  )
}
