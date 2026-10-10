import type { V2ScopeContext } from '../domain/scope'
import { V2ControlPlaneStore } from '../control-plane/store'
import { govern, type GovernanceDecision } from '../workspace/authorization'
import {
  buildEnterpriseEntityObservation,
  reconcileEnterpriseEntity,
  type EnterpriseEntityIdentity,
  type EnterpriseEntityIdentifier,
  type EnterpriseEntityReconciliation,
  type EnterpriseEntityType,
} from './enterpriseEntityIntelligence'
import type { EnterpriseSourceContract, EnterpriseSourceSnapshot } from './enterpriseSourceContract'

export interface EnterpriseEntityCandidateScope {
  organizationId: string
  workspaceId: string
  userId: string
}

export interface ResolveAuthorizedEnterpriseEntityParams {
  store: V2ControlPlaneStore
  userId: string
  permission: string
  context: V2ScopeContext
  sourceContract: EnterpriseSourceContract
  sourceSnapshot: EnterpriseSourceSnapshot
  sourceRecordId: string
  requiredCapability: string
  entityType: EnterpriseEntityType
  name: string
  aliases?: readonly string[]
  identifiers: readonly EnterpriseEntityIdentifier[]
  now?: string
  /** Called only after governance succeeds and the source snapshot validates. */
  loadCandidates: (scope: EnterpriseEntityCandidateScope) => Promise<readonly EnterpriseEntityIdentity[]>
}

export type AuthorizedEnterpriseEntityResolution =
  | { status: 'denied'; governance: Extract<GovernanceDecision, { allowed: false }> }
  | { status: 'invalid_source'; issues: Array<{ code: string; message: string }> }
  | { status: 'scope_violation'; reason: string }
  | {
      status: 'resolved'
      governance: Extract<GovernanceDecision, { allowed: true }>
      observation: NonNullable<ReturnType<typeof buildEnterpriseEntityObservation>['observation']>
      reconciliation: EnterpriseEntityReconciliation
    }

/**
 * EIF-03 governed integration seam.
 *
 * This composes existing V2 governance with EIF-01 source validation and
 * EIF-02 deterministic reconciliation. It deliberately does not implement a
 * database adapter, HTTP endpoint, connector, graph write, or ledger write.
 * The candidate loader must itself use a server-authenticated database path
 * and preserve RLS; it is never invoked before governance/source validation.
 */
export async function resolveAuthorizedEnterpriseEntity(
  params: ResolveAuthorizedEnterpriseEntityParams,
): Promise<AuthorizedEnterpriseEntityResolution> {
  const { context, userId } = params
  if (
    !context.workspaceId ||
    context.userId !== userId ||
    !context.organizationId.trim() ||
    !context.workspaceId.trim()
  ) {
    return { status: 'scope_violation', reason: 'An authenticated user and explicit organization/Business Space scope are required.' }
  }

  const governance = govern(params.store, {
    userId,
    permission: params.permission,
    context,
    resource: {
      organizationId: context.organizationId,
      workspaceId: context.workspaceId,
      resourceType: 'enterprise_entity',
      action: 'reconcile',
    },
    requestedAutonomy: 'inform',
  })

  if (!governance.allowed) return { status: 'denied', governance }

  if (
    !params.requiredCapability.trim() ||
    !params.requiredCapability.endsWith('.read') ||
    !params.sourceContract.capabilities.includes(params.requiredCapability)
  ) {
    return { status: 'invalid_source', issues: [{ code: 'source_capability_not_granted', message: 'The source contract does not grant the required read capability.' }] }
  }

  const built = buildEnterpriseEntityObservation({
    contract: params.sourceContract,
    snapshot: params.sourceSnapshot,
    sourceRecordId: params.sourceRecordId,
    entityType: params.entityType,
    name: params.name,
    aliases: params.aliases,
    identifiers: params.identifiers,
    context,
    now: params.now,
  })
  if (!built.valid || !built.observation) {
    return { status: 'invalid_source', issues: built.issues }
  }

  // Do not silently filter tenant leakage here. It is an adapter-boundary
  // violation, so fail closed and let the caller repair the query/RLS path.
  const candidates = await params.loadCandidates({
    organizationId: context.organizationId,
    workspaceId: context.workspaceId,
    userId,
  })
  if (candidates.some(candidate =>
    candidate.organizationId !== context.organizationId ||
    candidate.workspaceId !== context.workspaceId
  )) {
    return { status: 'scope_violation', reason: 'Candidate loader returned an identity outside the authorized organization and Business Space.' }
  }

  const ids = candidates.map(candidate => candidate.id)
  if (new Set(ids).size !== ids.length) {
    return { status: 'scope_violation', reason: 'Candidate loader returned duplicate canonical identity IDs.' }
  }

  return {
    status: 'resolved',
    governance,
    observation: built.observation,
    reconciliation: reconcileEnterpriseEntity(built.observation, candidates, context),
  }
}
