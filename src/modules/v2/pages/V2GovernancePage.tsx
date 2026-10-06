import { useEffect, useState } from 'react'
import { useV2Space } from '../workspace/SpaceContext'
import { createGovernancePolicy, listGovernancePolicies, setGovernancePolicyStatus, updateGovernancePolicy, type GovernanceApprovalMode, type GovernanceAutonomy } from '../governance/api/governance'

const autonomy: GovernanceAutonomy[]=['inform','recommend','prepare','bounded']
const approvals: GovernanceApprovalMode[]=['never','consequential','always']

export function V2GovernancePage(){
  const {activeSpace}=useV2Space()
  const [policies,setPolicies]=useState<Awaited<ReturnType<typeof listGovernancePolicies>>>([])
  const [name,setName]=useState(''); const [busy,setBusy]=useState(false)
  async function refresh(){setPolicies(await listGovernancePolicies(activeSpace.kind==='business'?activeSpace.id:null))}
  useEffect(()=>{void refresh()},[activeSpace.id,activeSpace.kind])
  async function create(){if(!name.trim()||activeSpace.kind!=='business')return;setBusy(true);try{await createGovernancePolicy({workspaceId:activeSpace.id,name:name.trim(),slug:name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,63)});setName('');await refresh()}finally{setBusy(false)}}
  async function update(id:string,a:GovernanceAutonomy,m:GovernanceApprovalMode){setBusy(true);try{await updateGovernancePolicy(id,a,m,[]);await refresh()}finally{setBusy(false)}}
  return <section className="space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">V2-09</p><h1 className="mt-1 text-2xl font-semibold">Enterprise Governance</h1><p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">Define Space-level governance for autonomy, consequential actions and tool scope. NoVA Core remains execution authority.</p></div>
    {activeSpace.kind!=='business'?<div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 text-sm">Governance policies are configured in a Business Space. Switch Space to continue.</div>:
    <><div className="flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2 text-sm" value={name} onChange={e=>setName(e.target.value)} placeholder="Policy name"/><button className="rounded-xl bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--surface-base)] disabled:opacity-50" disabled={busy||!name.trim()} onClick={()=>void create()}>Create</button></div>
    <div className="grid gap-4">{policies.map(p=><article key={p.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{p.name}</h2><p className="text-xs text-[var(--text-secondary)]">{p.status} · {p.slug}</p></div><select className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1 text-sm" value={p.autonomyCeiling} disabled={busy} onChange={e=>void update(p.id,e.target.value as GovernanceAutonomy,p.approvalMode)}>{autonomy.map(v=><option key={v}>{v}</option>)}</select></div><div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><label className="flex items-center gap-2">Approval<select className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-2 py-1" value={p.approvalMode} disabled={busy} onChange={e=>void update(p.id,p.autonomyCeiling,e.target.value as GovernanceApprovalMode)}>{approvals.map(v=><option key={v}>{v}</option>)}</select></label><button className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs" disabled={busy} onClick={()=>void setGovernancePolicyStatus(p.id,p.status==='active'?'paused':'active').then(refresh)}>{p.status==='active'?'Pause':'Activate'}</button></div></article>)}</div></>}
  </section>
}
