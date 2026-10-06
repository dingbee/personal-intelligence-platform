import { describe, expect, it, vi } from 'vitest'
const rpc=vi.fn(); const select=vi.fn(); const eq=vi.fn(); const order=vi.fn()
vi.mock('@/shared/lib/supabase',()=>({supabase:{from:()=>({select,eq,order}),rpc}}))
import { createGovernancePolicy, listGovernancePolicies, setGovernancePolicyStatus, updateGovernancePolicy } from './governance'
describe('V2 governance API',()=>{
  it('requires an explicit Space for reads',async()=>{expect(await listGovernancePolicies(null)).toEqual([])})
  it('scopes reads to the Space',async()=>{select.mockReturnValue({eq});eq.mockReturnValue({order});order.mockResolvedValue({data:[],error:null});await listGovernancePolicies('w1');expect(eq).toHaveBeenCalledWith('workspace_id','w1')})
  it('creates through an authorized RPC',async()=>{rpc.mockResolvedValue({data:{id:'p1',owner_user_id:'u1',workspace_id:'w1',organization_id:'o1',name:'Default',slug:'default',description:'',status:'draft',autonomy_ceiling:'recommend',approval_mode:'consequential',allowed_tool_scopes:[],updated_at:'now'},error:null});expect((await createGovernancePolicy({workspaceId:'w1',name:'Default',slug:'default'})).id).toBe('p1');expect(rpc).toHaveBeenCalledWith('v2_create_governance_policy',expect.objectContaining({p_workspace_id:'w1'}))})
  it('updates constraints through the RPC',async()=>{rpc.mockResolvedValue({data:{id:'p1',owner_user_id:'u1',workspace_id:'w1',organization_id:'o1',name:'Default',slug:'default',description:'',status:'active',autonomy_ceiling:'prepare',approval_mode:'always',allowed_tool_scopes:['orders.read'],updated_at:'now'},error:null});const r=await updateGovernancePolicy('p1','prepare','always',['orders.read']);expect(r.autonomyCeiling).toBe('prepare');expect(r.approvalMode).toBe('always')})
  it('changes lifecycle through the RPC',async()=>{rpc.mockResolvedValue({data:{id:'p1',owner_user_id:'u1',workspace_id:'w1',organization_id:'o1',name:'Default',slug:'default',description:'',status:'paused',autonomy_ceiling:'recommend',approval_mode:'consequential',allowed_tool_scopes:[],updated_at:'now'},error:null});expect((await setGovernancePolicyStatus('p1','paused')).status).toBe('paused')})
})
