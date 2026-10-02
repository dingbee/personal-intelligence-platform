import type { Objective, Project, ResourceMetadata, UUID } from '../domain/model'
import { V2ControlPlaneStore } from '../control-plane/store'

type LifecycleMetadata = Pick<ResourceMetadata, 'createdAt' | 'updatedAt'>

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

export function archiveProject(
  store: V2ControlPlaneStore,
  projectId: UUID,
  metadata: LifecycleMetadata,
): Project {
  const project = store.get('project', projectId)
  if (!project) throw new Error('V2 project does not exist.')

  const archived: Project = {
    ...project,
    status: 'archived',
    updatedAt: metadata.updatedAt,
  }
  store.replace('project', archived)
  return archived
}
