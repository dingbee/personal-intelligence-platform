import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useV2Space } from '../workspace/SpaceContext'
import { listV2Agents } from '../agents/api/agentManagement'
import {
  createV2Workflow,
  getV2WorkflowVersions,
  listV2Workflows,
  saveV2WorkflowVersion,
  setV2WorkflowStatus,
  validateV2Workflow,
  validateWorkflowDefinitionClient,
  type V2Workflow,
  type V2WorkflowDefinition,
  type V2WorkflowNode,
  type V2WorkflowNodeType,
  type V2WorkflowStatus,
  type V2WorkflowTriggerType,
} from '../workflows/api/workflowStudio'

const statusLabel: Record<V2WorkflowStatus, string> = {
  draft: 'Draft',
  validated: 'Validated',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

const nodeTypes: V2WorkflowNodeType[] = ['start', 'understand', 'agent', 'tool', 'condition', 'approval', 'action', 'verify']

const emptyDefinition = (): V2WorkflowDefinition => ({
  version: 1,
  trigger: { type: 'manual', config: {} },
  nodes: [{ id: 'start', type: 'start', config: {}, next: [] }],
})

function newNode(type: V2WorkflowNodeType, index: number): V2WorkflowNode {
  return {
    id: `${type}-${index}`,
    type,
    config: type === 'approval' ? { mode: 'human' } : {},
    next: [],
  }
}

export function V2WorkflowStudioPage() {
  const { activeSpace } = useV2Space()
  const queryClient = useQueryClient()
  const workspaceId = activeSpace?.kind === 'business' ? activeSpace.spaceId : null
  const canEdit = activeSpace?.kind === 'business'
    && (activeSpace.membershipRole === 'editor' || activeSpace.membershipRole === 'owner')
  const canActivate = activeSpace?.kind === 'business'
    && activeSpace.membershipRole === 'owner'

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [definition, setDefinition] = useState<V2WorkflowDefinition>(() => emptyDefinition())
  const [selectedNodeId, setSelectedNodeId] = useState('start')
  const [error, setError] = useState<string | null>(null)

  const workflowsQuery = useQuery({
    queryKey: ['v2-workflows', workspaceId],
    queryFn: () => listV2Workflows(workspaceId),
    enabled: Boolean(workspaceId),
  })

  const agentsQuery = useQuery({
    queryKey: ['v2-workflow-agents', workspaceId],
    queryFn: () => listV2Agents(workspaceId),
    enabled: Boolean(workspaceId),
  })

  const selectedWorkflow = useMemo(
    () => workflowsQuery.data?.find((workflow) => workflow.id === selectedId) ?? workflowsQuery.data?.[0] ?? null,
    [selectedId, workflowsQuery.data],
  )

  const versionsQuery = useQuery({
    queryKey: ['v2-workflow-versions', selectedWorkflow?.id],
    queryFn: () => getV2WorkflowVersions(selectedWorkflow!.id),
    enabled: Boolean(selectedWorkflow),
  })

  useEffect(() => {
    const latest = versionsQuery.data?.[0]
    if (!latest) return
    setDefinition(latest.definition)
    setSelectedNodeId(latest.definition.nodes[0]?.id ?? 'start')
  }, [selectedWorkflow?.id, versionsQuery.data])

  const createMutation = useMutation({
    mutationFn: () => createV2Workflow({ workspaceId: workspaceId!, name, slug, description }),
    onSuccess: (workflow) => {
      setSelectedId(workflow.id)
      setName('')
      setSlug('')
      setDescription('')
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['v2-workflows', workspaceId] })
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
  })

  const saveMutation = useMutation({
    mutationFn: () => saveV2WorkflowVersion(selectedWorkflow!.id, definition),
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['v2-workflow-versions', selectedWorkflow?.id] })
      void queryClient.invalidateQueries({ queryKey: ['v2-workflows', workspaceId] })
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
  })

  const validateMutation = useMutation({
    mutationFn: () => validateV2Workflow(selectedWorkflow!.id),
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['v2-workflow-versions', selectedWorkflow?.id] })
      void queryClient.invalidateQueries({ queryKey: ['v2-workflows', workspaceId] })
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
  })

  const statusMutation = useMutation({
    mutationFn: (status: V2WorkflowStatus) => setV2WorkflowStatus(selectedWorkflow!.id, status),
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['v2-workflow-versions', selectedWorkflow?.id] })
      void queryClient.invalidateQueries({ queryKey: ['v2-workflows', workspaceId] })
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : String(cause)),
  })

  const selectedNode = definition.nodes.find((node) => node.id === selectedNodeId) ?? definition.nodes[0] ?? null
  const validationErrors = validateWorkflowDefinitionClient(definition)

  const updateNode = (nodeId: string, patch: Partial<V2WorkflowNode>) => {
    setDefinition((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, ...patch } : node),
    }))
  }

  const addNode = (type: V2WorkflowNodeType) => {
    const node = newNode(type, definition.nodes.length + 1)
    setDefinition((current) => ({ ...current, nodes: [...current.nodes, node] }))
    setSelectedNodeId(node.id)
  }

  const toggleNext = (targetId: string) => {
    if (!selectedNode) return
    updateNode(selectedNode.id, {
      next: selectedNode.next.includes(targetId)
        ? selectedNode.next.filter((id) => id !== targetId)
        : [...selectedNode.next, targetId],
    })
  }

  return (
    <div className="min-h-full bg-[var(--surface-base)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
                <span className="rounded-full border border-[var(--border-subtle)] px-3 py-1">ARRIYIA V2</span>
                <span>WORKFLOW CONTROL PLANE</span>
                <span>·</span>
                <span>{activeSpace?.name ?? 'No Space'}</span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] md:text-4xl">Workflow Studio</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
                Compose governed agents, tools, conditions, approvals and actions into versioned declarative workflows.
                Studio defines the workflow; NoVA Core executes it later through the runtime contract.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              <Link to="/v2" className="rounded-xl border px-3 py-2 text-sm">Command Centre</Link>
              <Link to="/v2/agents" className="rounded-xl border px-3 py-2 text-sm">Agents</Link>
              <Link to="/v2/knowledge-memory" className="rounded-xl border px-3 py-2 text-sm">Knowledge</Link>
            </nav>
          </div>
        </header>

        {error && <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
            <div className="flex items-center justify-between">
              <div><h2 className="font-semibold text-[var(--text-primary)]">Workflows</h2><p className="text-xs text-[var(--text-secondary)]">{workflowsQuery.data?.length ?? 0} in this Space</p></div>
            </div>
            <div className="mt-4 space-y-2">
              {(workflowsQuery.data ?? []).map((workflow) => (
                <button key={workflow.id} type="button" onClick={() => setSelectedId(workflow.id)} className={`w-full rounded-2xl border p-3 text-left ${selectedWorkflow?.id === workflow.id ? 'border-[var(--text-primary)] bg-[var(--surface-muted)]' : 'border-[var(--border-subtle)]'}`}>
                  <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-[var(--text-primary)]">{workflow.name}</span><span className="text-[10px] uppercase text-[var(--text-secondary)]">{statusLabel[workflow.status]}</span></div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">v{workflow.activeVersion ?? '—'} · {workflow.slug}</div>
                </button>
              ))}
              {!workflowsQuery.isLoading && (workflowsQuery.data ?? []).length === 0 && <p className="rounded-2xl border border-dashed p-4 text-sm text-[var(--text-secondary)]">No workflows yet.</p>}
            </div>

            <form className="mt-5 space-y-3 border-t border-[var(--border-subtle)] pt-5" onSubmit={(event) => { event.preventDefault(); if (canEdit && name.trim() && slug.trim()) createMutation.mutate() }}>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Create workflow</div>
              <input className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="slug e.g. weekly-executive-brief" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))} />
              <textarea className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              <button disabled={!canEdit || createMutation.isPending} className="w-full rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--surface-base)] disabled:opacity-40">{createMutation.isPending ? 'Creating…' : 'Create workflow'}</button>
            </form>
          </aside>

          <main className="space-y-6">
            {!selectedWorkflow ? (
              <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6">
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">Build the workflow</h2>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Create a workflow in the active Business Space to begin.</p>
              </section>
            ) : (
              <>
                <section className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div><div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Workflow</div><h2 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{selectedWorkflow.name}</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedWorkflow.description || 'No description'}</p></div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border px-3 py-1 text-xs">{statusLabel[selectedWorkflow.status]}</span>
                      {canEdit && selectedWorkflow.status !== 'archived' && <button type="button" onClick={() => statusMutation.mutate(selectedWorkflow.status === 'paused' ? 'draft' : 'paused')} className="rounded-xl border px-3 py-2 text-xs">{selectedWorkflow.status === 'paused' ? 'Resume' : 'Pause'}</button>}
                      {canActivate && selectedWorkflow.status !== 'archived' && <button type="button" disabled={statusMutation.isPending || validationErrors.length > 0} onClick={() => statusMutation.mutate('active')} className="rounded-xl bg-[var(--text-primary)] px-3 py-2 text-xs text-[var(--surface-base)] disabled:opacity-40">Activate</button>}
                      {canEdit && selectedWorkflow.status !== 'archived' && <button type="button" onClick={() => statusMutation.mutate('archived')} className="rounded-xl border px-3 py-2 text-xs">Archive</button>}
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
                  <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Workflow graph</div><h3 className="mt-1 font-semibold text-[var(--text-primary)]">Declarative nodes and edges</h3></div>
                      <select className="rounded-xl border bg-transparent px-3 py-2 text-sm" value={definition.trigger.type} onChange={(e) => setDefinition({ ...definition, trigger: { ...definition.trigger, type: e.target.value as V2WorkflowTriggerType } })}>
                        <option value="manual">Manual trigger</option><option value="event">Event trigger</option><option value="schedule">Schedule trigger</option><option value="webhook">Webhook trigger</option>
                      </select>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {definition.nodes.map((node) => (
                        <button key={node.id} type="button" onClick={() => setSelectedNodeId(node.id)} className={`rounded-2xl border p-4 text-left ${selectedNode?.id === node.id ? 'border-[var(--text-primary)] bg-[var(--surface-muted)]' : 'border-[var(--border-subtle)]'}`}>
                          <div className="flex items-center justify-between gap-2"><span className="font-medium text-sm text-[var(--text-primary)]">{node.id}</span><span className="text-[10px] uppercase text-[var(--text-secondary)]">{node.type}</span></div>
                          <div className="mt-2 text-xs text-[var(--text-secondary)]">Next: {node.next.length ? node.next.join(', ') : 'end'}</div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {nodeTypes.filter((type) => type !== 'start').map((type) => <button key={type} type="button" disabled={!canEdit} onClick={() => addNode(type)} className="rounded-xl border px-3 py-2 text-xs disabled:opacity-40">+ {type}</button>)}
                    </div>

                    {selectedNode && (
                      <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
                        <div className="flex items-center justify-between gap-3"><div><div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Selected node</div><h4 className="mt-1 font-semibold text-[var(--text-primary)]">{selectedNode.id}</h4></div><span className="rounded-full border px-2 py-1 text-[10px] uppercase">{selectedNode.type}</span></div>
                        <input disabled={!canEdit} className="mt-4 w-full rounded-xl border bg-transparent px-3 py-2 text-sm" value={selectedNode.id} onChange={(e) => updateNode(selectedNode.id, { id: e.target.value })} />
                        {selectedNode.type === 'agent' && <select disabled={!canEdit} className="mt-3 w-full rounded-xl border bg-transparent px-3 py-2 text-sm" value={String(selectedNode.config.agentId ?? '')} onChange={(e) => updateNode(selectedNode.id, { config: { ...selectedNode.config, agentId: e.target.value } })}><option value="">Select active agent</option>{(agentsQuery.data ?? []).filter((agent) => agent.status === 'active').map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select>}
                        {selectedNode.type === 'tool' && <input disabled={!canEdit} className="mt-3 w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="Tool ID" value={String(selectedNode.config.toolId ?? '')} onChange={(e) => updateNode(selectedNode.id, { config: { ...selectedNode.config, toolId: e.target.value } })} />}
                        {selectedNode.type === 'action' && <input disabled={!canEdit} className="mt-3 w-full rounded-xl border bg-transparent px-3 py-2 text-sm" placeholder="Action ID" value={String(selectedNode.config.actionId ?? '')} onChange={(e) => updateNode(selectedNode.id, { config: { ...selectedNode.config, actionId: e.target.value } })} />}
                        {selectedNode.type === 'approval' && <select disabled={!canEdit} className="mt-3 w-full rounded-xl border bg-transparent px-3 py-2 text-sm" value={String(selectedNode.config.mode ?? 'human')} onChange={(e) => updateNode(selectedNode.id, { config: { ...selectedNode.config, mode: e.target.value } })}><option value="human">Human approval</option><option value="policy">Policy approval</option></select>}
                        {selectedNode.type === 'condition' && <textarea disabled={!canEdit} className="mt-3 w-full rounded-xl border bg-transparent px-3 py-2 text-sm" rows={3} placeholder="Declarative condition expression" value={String(selectedNode.config.expression ?? '')} onChange={(e) => updateNode(selectedNode.id, { config: { ...selectedNode.config, expression: e.target.value } })} />}
                        <div className="mt-4"><div className="text-xs font-medium text-[var(--text-secondary)]">Edges →</div><div className="mt-2 flex flex-wrap gap-2">{definition.nodes.filter((node) => node.id !== selectedNode.id).map((node) => <button key={node.id} type="button" disabled={!canEdit} onClick={() => toggleNext(node.id)} className={`rounded-lg border px-2.5 py-1.5 text-xs ${selectedNode.next.includes(node.id) ? 'bg-[var(--surface-raised)] font-medium' : ''} disabled:opacity-40`}>{node.id}</button>)}</div></div>
                      </div>
                    )}
                  </article>

                  <aside className="space-y-6">
                    <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Validation</div>
                      {validationErrors.length === 0 ? <p className="mt-3 text-sm text-[var(--text-primary)]">Local graph checks pass. Server validation also verifies Space-scoped active-agent dependencies.</p> : <ul className="mt-3 space-y-2 text-sm text-red-700">{validationErrors.map((item) => <li key={item}>• {item}</li>)}</ul>}
                      <div className="mt-5 flex flex-wrap gap-2">
                        <button type="button" disabled={!canEdit || saveMutation.isPending || validationErrors.length > 0} onClick={() => saveMutation.mutate()} className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--surface-base)] disabled:opacity-40">{saveMutation.isPending ? 'Saving…' : 'Save version'}</button>
                        <button type="button" disabled={!canEdit || validateMutation.isPending || validationErrors.length > 0} onClick={() => validateMutation.mutate()} className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-40">{validateMutation.isPending ? 'Validating…' : 'Validate'}</button>
                      </div>
                    </article>

                    <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 md:p-6">
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Version history</div>
                      <div className="mt-4 space-y-2">{(versionsQuery.data ?? []).map((version) => <button key={version.id} type="button" onClick={() => { setDefinition(version.definition); setSelectedNodeId(version.definition.nodes[0]?.id ?? 'start') }} className="w-full rounded-2xl border p-3 text-left"><div className="flex justify-between gap-2"><span className="text-sm font-medium">Version {version.version}</span><span className="text-xs text-[var(--text-secondary)]">{version.status}</span></div><div className="mt-1 text-xs text-[var(--text-secondary)]">{version.definition.trigger.type} · {version.definition.nodes.length} nodes</div></button>)}</div>
                    </article>

                    <article className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-5">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Execution boundary</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">V2 owns workflow identity, versioning, graph integrity, dependency references and lifecycle. It does not execute, schedule, invoke tools or run agents. NoVA Core remains the runtime.</p>
                    </article>
                  </aside>
                </section>
              </>
            )}
          </main>
        </section>
      </div>
    </div>
  )
}
