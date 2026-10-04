import type {
  Agent,
  Action,
  Approval,
  BusinessUnit,
  Context,
  Event,
  Insight,
  Memory,
  Objective,
  Organization,
  Outcome,
  Feedback,
  Intervention,
  LearningSignal,
  Permission,
  Policy,
  Prediction,
  Project,
  Recommendation,
  ResourceMetadata,
  Role,
  Run,
  Signal,
  Task,
  Team,
  Tool,
  User,
  Workflow,
  Workspace,
  WorkspaceMembership,
  TeamMembership,
  V2DomainResource,
} from '../domain/model'
import type { V2ScopeContext } from '../domain/scope'
import { assertScope, isWithinScope } from '../domain/scope'

export interface V2ResourceMap {
  organization: Organization
  workspace: Workspace
  businessUnit: BusinessUnit
  team: Team
  user: User
  role: Role
  permission: Permission
  policy: Policy
  project: Project
  objective: Objective
  agent: Agent
  task: Task
  workflow: Workflow
  tool: Tool
  context: Context
  memory: Memory
  event: Event
  signal: Signal
  insight: Insight
  recommendation: Recommendation
  prediction: Prediction
  action: Action
  outcome: Outcome
  feedback: Feedback
  intervention: Intervention
  learningSignal: LearningSignal
  approval: Approval
  run: Run
  workspaceMembership: WorkspaceMembership
  teamMembership: TeamMembership
}

type ResourceType = V2DomainResource
type ResourceOf<K extends ResourceType> = V2ResourceMap[K]

const RESOURCE_TYPES: ResourceType[] = [
  'organization',
  'workspace',
  'businessUnit',
  'team',
  'user',
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
  'workspaceMembership',
  'teamMembership',
]

type ResourceBuckets = {
  [K in ResourceType]: Map<string, ResourceOf<K>>
}

function createBuckets(): ResourceBuckets {
  return Object.fromEntries(
    RESOURCE_TYPES.map((type) => [type, new Map()]),
  ) as ResourceBuckets
}

/**
 * Persistence-agnostic V2 control-plane resource store.
 *
 * This is intentionally an in-memory domain adapter, not a database abstraction.
 * It establishes identity, scope and relationship invariants before persistence
 * is introduced. V1 Supabase tables are never touched by this layer.
 */
export class V2ControlPlaneStore {
  private readonly buckets: ResourceBuckets = createBuckets()

  save<K extends ResourceType>(type: K, resource: ResourceOf<K>): void {
    this.assertResourceIntegrity(type, resource)

    const bucket = this.buckets[type] as Map<string, ResourceOf<K>>
    if (bucket.has(resource.id)) {
      throw new Error(`V2 ${type} with id "${resource.id}" already exists.`)
    }

    bucket.set(resource.id, resource)
  }

  replace<K extends ResourceType>(type: K, resource: ResourceOf<K>): void {
    this.assertResourceIntegrity(type, resource)

    const bucket = this.buckets[type] as Map<string, ResourceOf<K>>
    if (!bucket.has(resource.id)) {
      throw new Error(`V2 ${type} with id "${resource.id}" does not exist.`)
    }

    bucket.set(resource.id, resource)
  }

  get<K extends ResourceType>(type: K, id: string): ResourceOf<K> | undefined {
    return (this.buckets[type] as Map<string, ResourceOf<K>>).get(id)
  }

  getScoped<K extends ResourceType>(
    type: K,
    id: string,
    context: V2ScopeContext,
  ): ResourceOf<K> | undefined {
    const resource = this.get(type, id)
    if (!resource) return undefined
    assertScope(resource, context)
    return resource
  }

  list<K extends ResourceType>(
    type: K,
    context?: V2ScopeContext,
  ): ResourceOf<K>[] {
    const resources = Array.from(
      (this.buckets[type] as Map<string, ResourceOf<K>>).values(),
    )

    if (!context) return resources

    return resources.filter((resource) => isWithinScope(resource, context))
  }

  remove<K extends ResourceType>(type: K, id: string): boolean {
    return (this.buckets[type] as Map<string, ResourceOf<K>>).delete(id)
  }

  isOwnedBy(
    resource: ResourceMetadata,
    principal: { userId?: string; teamId?: string },
  ): boolean {
    if (principal.userId && resource.ownerUserId === principal.userId) return true
    if (principal.teamId && resource.ownerTeamId === principal.teamId) return true
    return false
  }

  private assertResourceIntegrity<K extends ResourceType>(
    type: K,
    resource: ResourceOf<K> & { id: string; organizationId: string },
  ): void {
    if (!resource.id) throw new Error(`V2 ${type} requires an id.`)
    if (!resource.organizationId) {
      throw new Error(`V2 ${type} requires an organization scope.`)
    }

    const scoped = resource as ResourceOf<K> & { workspaceId?: string; userId?: string; roleId?: string; teamId?: string; projectId?: string }

    switch (type) {
      case 'workspace': {
        this.assertParent('organization', resource.organizationId, resource.organizationId)
        break
      }
      case 'workspaceMembership': {
        if (!scoped.workspaceId || !scoped.userId || !scoped.roleId) throw new Error('V2 workspace membership requires workspace, user and role references.')
        this.assertParent('workspace', scoped.workspaceId, resource.organizationId)
        this.assertParent('user', scoped.userId, resource.organizationId)
        this.assertParent('role', scoped.roleId, resource.organizationId)
        break
      }
      case 'teamMembership': {
        if (!scoped.workspaceId || !scoped.teamId || !scoped.userId) throw new Error('V2 team membership requires workspace, team and user references.')
        this.assertParent('workspace', scoped.workspaceId, resource.organizationId)
        this.assertParent('team', scoped.teamId, resource.organizationId)
        if (this.get('team', scoped.teamId)?.workspaceId !== scoped.workspaceId) {
          throw new Error('V2 team membership must belong to the same workspace as its team.')
        }
        this.assertParent('user', scoped.userId!, resource.organizationId)
        break
      }
      case 'businessUnit':
      case 'team':
      case 'project':
      case 'agent':
      case 'task':
      case 'workflow':
      case 'context':
      case 'action':
      case 'feedback':
      case 'intervention':
      case 'learningSignal':
      case 'approval':
      case 'run': {
        const workspaceId = scoped.workspaceId
        if (!workspaceId) {
          throw new Error(`V2 ${type} requires a workspace scope.`)
        }
        this.assertParent('workspace', workspaceId, resource.organizationId)
        break
      }
      case 'objective': {
        if (!scoped.projectId || !scoped.workspaceId) throw new Error('V2 objective requires project and workspace references.')
        this.assertParent('project', scoped.projectId, resource.organizationId)
        const project = this.get('project', scoped.projectId)
        if (project?.workspaceId !== scoped.workspaceId) {
          throw new Error('V2 objective must belong to the same workspace as its project.')
        }
        break
      }
      default:
        break
    }
  }

  private assertParent<K extends ResourceType>(
    type: K,
    id: string,
    organizationId: string,
  ): void {
    const parent = this.get(type, id)
    if (!parent) {
      throw new Error(`V2 ${type} "${id}" must exist before its child can be registered.`)
    }
    if (parent.organizationId !== organizationId) {
      throw new Error(`V2 ${type} "${id}" belongs to a different organization.`)
    }
  }
}
