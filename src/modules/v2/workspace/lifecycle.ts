import type { Objective, Project, ResourceMetadata, UUID, Workspace } from '../domain/model'
import { V2ControlPlaneStore } from '../control-plane/store'

type LifecycleMetadata = Pick<ResourceMetadata, 'createdAt' | 'updatedAt'>

export function createWorkspace(
  store: V2ControlPlaneStore,
  input: { id: UUID; organizationId: UUID; name: string; slug: string; description?: string },
  metadata: LifecycleMetadata,
): Workspace {
  const workspace: Workspace = {
    id: input.id,
    organizationId: input.organizationId,
    name: input.name,
    slug: input.slug,
    description: input.description,
    status: 'active',
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  }
  store.save('workspace', workspace)
  return workspace
}

export function updateWorkspace(
  store: V2ControlPlaneStore,
  workspaceId: UUID,
  input: { name?: string; slug?: string; description?: string },
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): Workspace {
  const workspace = store.get('workspace', workspaceId)
  if (!workspace) throw new Error('V2 workspace does not exist.')

  const updated: Workspace = {
    ...workspace,
    name: input.name ?? workspace.name,
    slug: input.slug ?? workspace.slug,
    description: input.description ?? workspace.description,
    updatedAt: metadata.updatedAt,
  }
  store.replace('workspace', updated)
  return updated
}

export function setWorkspaceStatus(
  store: V2ControlPlaneStore,
  workspaceId: UUID,
  status: 'active' | 'paused' | 'archived',
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): Workspace {
  const workspace = store.get('workspace', workspaceId)
  if (!workspace) throw new Error('V2 workspace does not exist.')

  const updated: Workspace = { ...workspace, status, updatedAt: metadata.updatedAt }
  store.replace('workspace', updated)
  return updated
}

export function createProject(
  store: V2ControlPlaneStore,
  input: { id: UUID; organizationId: UUID; workspaceId: UUID; name: string; description?: string },
  metadata: LifecycleMetadata,
): Project {
  const project: Project = {
    id: input.id,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    name: input.name,
    description: input.description,
    objectiveIds: [],
    status: 'draft',
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  }
  store.save('project', project)
  return project
}

export function updateProject(
  store: V2ControlPlaneStore,
  projectId: UUID,
  input: { name?: string; description?: string },
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): Project {
  const project = store.get('project', projectId)
  if (!project) throw new Error('V2 project does not exist.')

  const updated: Project = {
    ...project,
    name: input.name ?? project.name,
    description: input.description ?? project.description,
    updatedAt: metadata.updatedAt,
  }
  store.replace('project', updated)
  return updated
}

export function setProjectStatus(
  store: V2ControlPlaneStore,
  projectId: UUID,
  status: 'draft' | 'active' | 'paused' | 'archived',
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): Project {
  const project = store.get('project', projectId)
  if (!project) throw new Error('V2 project does not exist.')

  const updated: Project = { ...project, status, updatedAt: metadata.updatedAt }
  store.replace('project', updated)
  return updated
}

export function archiveProject(
  store: V2ControlPlaneStore,
  projectId: UUID,
  metadata: LifecycleMetadata,
): Project {
  return setProjectStatus(store, projectId, 'archived', metadata)
}

export function createObjective(
  store: V2ControlPlaneStore,
  input: { id: UUID; organizationId: UUID; workspaceId: UUID; projectId: UUID; title: string; description?: string },
  metadata: LifecycleMetadata,
): Objective {
  const objective: Objective = {
    id: input.id,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    status: 'draft',
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  }

  store.save('objective', objective)

  const project = store.get('project', input.projectId)
  if (!project) throw new Error('V2 project does not exist.')
  store.replace('project', {
    ...project,
    objectiveIds: [...project.objectiveIds, objective.id],
    updatedAt: metadata.updatedAt,
  })

  return objective
}

export function updateObjective(
  store: V2ControlPlaneStore,
  objectiveId: UUID,
  input: { title?: string; description?: string; target?: Record<string, unknown> },
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): Objective {
  const objective = store.get('objective', objectiveId)
  if (!objective) throw new Error('V2 objective does not exist.')

  const updated: Objective = {
    ...objective,
    title: input.title ?? objective.title,
    description: input.description ?? objective.description,
    target: input.target ?? objective.target,
    updatedAt: metadata.updatedAt,
  }
  store.replace('objective', updated)
  return updated
}

export function setObjectiveStatus(
  store: V2ControlPlaneStore,
  objectiveId: UUID,
  status: 'draft' | 'active' | 'paused' | 'archived',
  metadata: Pick<ResourceMetadata, 'updatedAt'>,
): Objective {
  const objective = store.get('objective', objectiveId)
  if (!objective) throw new Error('V2 objective does not exist.')

  const updated: Objective = { ...objective, status, updatedAt: metadata.updatedAt }
  store.replace('objective', updated)
  return updated
}
