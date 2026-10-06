import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { UUID } from '../domain/model'
import { toActiveSpaceContext, type ActiveSpaceContext, type SpaceDescriptor } from './space'

export interface V2SpaceContextValue {
  spaces: SpaceDescriptor[]
  activeSpace: ActiveSpaceContext | null
  setActiveSpaceId: (spaceId: UUID) => void
}

const V2SpaceContext = createContext<V2SpaceContextValue | undefined>(undefined)

export function V2SpaceProvider({
  userId,
  spaces,
  children,
}: {
  userId: UUID
  spaces: SpaceDescriptor[]
  children: ReactNode
}) {
  const [activeSpaceId, setActiveSpaceIdState] = useState<UUID>(
    spaces[0]?.id ?? '',
  )

  const activeSpace = useMemo(() => {
    const space = spaces.find((candidate) => candidate.id === activeSpaceId)
    return space ? toActiveSpaceContext(space, userId) : null
  }, [activeSpaceId, spaces, userId])

  const value = useMemo<V2SpaceContextValue>(
    () => ({
      spaces,
      activeSpace,
      setActiveSpaceId: (spaceId) => {
        const next = spaces.find((space) => space.id === spaceId)
        if (!next) throw new Error('V2 space is not available to the active identity.')
        setActiveSpaceIdState(spaceId)
      },
    }),
    [spaces, activeSpace],
  )

  return <V2SpaceContext.Provider value={value}>{children}</V2SpaceContext.Provider>
}

export function useV2Space(): V2SpaceContextValue {
  const context = useContext(V2SpaceContext)
  if (!context) throw new Error('useV2Space must be used within V2SpaceProvider')
  return context
}
