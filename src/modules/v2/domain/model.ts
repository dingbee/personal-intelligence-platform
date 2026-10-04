/**
 * ARRIYIA V2 canonical domain contracts.
 *
 * This file is deliberately persistence-agnostic. V2 domain resources must be
 * usable before a database schema exists, and no type here assumes the V1
 * production Supabase schema.
 */

import type { AutonomyLevel } from './autonomy'

export type UUID = string

export type ResourceStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'archived'
  | 'failed'

export type RunStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type MemoryScope = 'organization' | 'workspace' | 'project' | 'agent' | 'user' | 'run'

export interface ResourceScope {
  organizationId: UUID
  workspaceId?: UUID
}

export interface ResourceOwner {
  ownerUserId?: UUID
  ownerTeamId?: UUID
}

export interface ResourceMetadata extends ResourceScope, ResourceOwner {
  id: UUID
  createdAt: string
  updatedAt: string
  status: ResourceStatus
  provenance?: ProvenanceRef[]
  version?: number
  auditRef?: UUID
  executionRef?: UUID
}

export interface ProvenanceRef {
  sourceType: string
  sourceId: UUID
  locator?: string
  capturedAt?: string
}

export interface Organization extends ResourceMetadata {
  name: string
  slug: string
}

export interface Workspace extends ResourceMetadata {
  organizationId: UUID
  name: string
  slug: string
  description?: string
}

export interface BusinessUnit extends ResourceMetadata {
  workspaceId: UUID
  name: string
}

export interface Team extends ResourceMetadata {
  workspaceId: UUID
  name: string
}

export interface User extends ResourceMetadata {
  email: string
  displayName: string
}

export type WorkspaceMembershipStatus = 'active' | 'invited' | 'suspended' | 'removed'

export interface WorkspaceMembership extends ResourceScope, ResourceOwner {
  id: UUID
  workspaceId: UUID
  userId: UUID
  roleId: UUID
  status: WorkspaceMembershipStatus
  invitedBy?: UUID
  createdAt: string
  updatedAt: string
}

export interface TeamMembership extends ResourceScope, ResourceOwner {
  id: UUID
  workspaceId: UUID
  teamId: UUID
  userId: UUID
  roleId?: UUID
  status: 'active'
  createdAt: string
  updatedAt: string
}

export interface Role extends ResourceMetadata {
  name: string
  permissions: UUID[]
}

export interface Permission extends ResourceMetadata {
  key: string
  description?: string
}

export interface Policy extends ResourceMetadata {
  name: string
  effect: 'allow' | 'deny'
  rules: PolicyRule[]
  /** Maximum autonomy this policy permits for matching actions. */
  maximumAutonomy?: AutonomyLevel
}

export interface PolicyRule {
  resource: string
  action: string
  conditions?: Record<string, unknown>
}

export interface Project extends ResourceMetadata {
  workspaceId: UUID
  name: string
  description?: string
  objectiveIds: UUID[]
}

export interface Objective extends ResourceMetadata {
  projectId: UUID
  title: string
  description?: string
  target?: Record<string, unknown>
}

export interface Agent extends ResourceMetadata {
  workspaceId: UUID
  name: string
  description?: string
  definition: AgentDefinition
}

export interface AgentDefinition {
  version: number
  systemPurpose: string
  capabilities: string[]
  toolIds: UUID[]
  memoryScopes: MemoryScope[]
  policyIds: UUID[]
  /** Highest autonomy this agent may request; never grants execution authority. */
  autonomyCeiling: AutonomyLevel
}

export interface Task extends ResourceMetadata {
  workspaceId: UUID
  title: string
  agentId?: UUID
  projectId?: UUID
  objectiveId?: UUID
  input?: Record<string, unknown>
}

export interface Workflow extends ResourceMetadata {
  workspaceId: UUID
  name: string
  description?: string
  definition: WorkflowDefinition
}

export interface WorkflowDefinition {
  version: number
  trigger: WorkflowTrigger
  nodes: WorkflowNode[]
}

export type WorkflowTrigger =
  | { type: 'manual' }
  | { type: 'event'; eventType: string }
  | { type: 'schedule'; expression: string }
  | { type: 'webhook'; key: string }

export interface WorkflowNode {
  id: string
  type: 'understand' | 'agent' | 'tool' | 'condition' | 'approval' | 'action' | 'verify'
  name: string
  config: Record<string, unknown>
  next?: string[]
}

export interface Tool extends ResourceMetadata {
  workspaceId?: UUID
  name: string
  description?: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  capability: string
  requiredPermissions: string[]
  requiresApproval?: boolean
}

export interface Context extends ResourceMetadata {
  workspaceId: UUID
  kind: string
  data: Record<string, unknown>
}

export interface Memory extends ResourceMetadata {
  scope: MemoryScope
  scopeId: UUID
  key: string
  value: unknown
  confidence?: number
  expiresAt?: string
}

export interface Event extends ResourceMetadata {
  type: string
  occurredAt: string
  payload: Record<string, unknown>
}

export interface Signal extends ResourceMetadata {
  sourceEventId?: UUID
  type: string
  payload: Record<string, unknown>
}

export interface Insight extends ResourceMetadata {
  signalIds: UUID[]
  statement: string
  evidence?: ProvenanceRef[]
  confidence?: number
}

export interface Recommendation extends ResourceMetadata {
  insightIds: UUID[]
  actionType: string
  rationale: string
  parameters?: Record<string, unknown>
  confidence?: number
}

export interface Prediction extends ResourceMetadata {
  subjectType: string
  subjectId: UUID
  outcome: string
  horizon?: string
  probability?: number
  assumptions?: string[]
}

export interface Action extends ResourceMetadata {
  workspaceId: UUID
  type: string
  target: string
  parameters: Record<string, unknown>
  authorizationPolicyIds: UUID[]
  approvalId?: UUID
}

export interface Outcome extends ResourceMetadata {
  actionId?: UUID
  runId?: UUID
  success: boolean
  result?: Record<string, unknown>
  impact?: Record<string, unknown>
}

export type FeedbackType = 'accepted' | 'rejected' | 'corrected' | 'irrelevant' | 'positive' | 'negative'

export interface Feedback extends ResourceMetadata {
  workspaceId: UUID
  subjectType: 'recommendation' | 'action' | 'outcome' | 'run'
  subjectId: UUID
  submittedBy: UUID
  type: FeedbackType
  rating?: number
  comment?: string
  correction?: Record<string, unknown>
}

export type InterventionType = 'accepted' | 'modified' | 'rejected' | 'overridden' | 'cancelled'

export interface Intervention extends ResourceMetadata {
  workspaceId: UUID
  recommendationId?: UUID
  actionId?: UUID
  runId?: UUID
  intervenedBy: UUID
  type: InterventionType
  reason?: string
  occurredAt: string
}

export interface LearningSignal extends ResourceMetadata {
  workspaceId: UUID
  signalType: string
  sourceType: 'feedback' | 'intervention' | 'outcome' | 'effectiveness'
  sourceId: UUID
  subjectType: 'recommendation' | 'action' | 'agent' | 'workflow' | 'tool'
  subjectId: UUID
  value: number
  confidence?: number
  evidenceIds: UUID[]
}

export interface Approval extends ResourceMetadata {
  workspaceId: UUID
  subjectType: string
  subjectId: UUID
  requestedBy: UUID
  decision?: 'approved' | 'rejected'
  decidedBy?: UUID
  decidedAt?: string
  reason?: string
  expiresAt?: string
}

export interface Run extends Omit<ResourceMetadata, 'status'> {
  workspaceId: UUID
  status: RunStatus
  agentId?: UUID
  workflowId?: UUID
  taskId?: UUID
  parentRunId?: UUID
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  startedAt?: string
  completedAt?: string
  error?: string
}

export interface DomainTrace {
  sourceIds: UUID[]
  contextIds: UUID[]
  signalIds: UUID[]
  insightIds: UUID[]
  recommendationIds: UUID[]
  approvalIds: UUID[]
  actionIds: UUID[]
  runIds: UUID[]
  eventIds: UUID[]
  outcomeIds: UUID[]
}

export const V2_DOMAIN_RESOURCES = [
  'organization',
  'workspace',
  'businessUnit',
  'team',
  'user',
  'workspaceMembership',
  'teamMembership',
  'role',
  'permission',
  'policy',
  'project',
  'objective',
  'agent',
  'task',
  'workflow',
  'tool',
  'context',
  'memory',
  'event',
  'signal',
  'insight',
  'recommendation',
  'prediction',
  'action',
  'outcome',
  'feedback',
  'intervention',
  'learningSignal',
  'approval',
  'run',
] as const

export type V2DomainResource = (typeof V2_DOMAIN_RESOURCES)[number]

export const V2_INTELLIGENCE_LOOP = [
  'observe',
  'understand',
  'reason',
  'recommend',
  'act',
  'learn',
] as const

export type V2IntelligenceStage = (typeof V2_INTELLIGENCE_LOOP)[number]
