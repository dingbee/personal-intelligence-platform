export interface Registry<T extends { id: string }> {
  register(item: T): void
  get(id: string): T | undefined
  list(): T[]
  has(id: string): boolean
}

/** Generic in-memory registry, reused for capabilities/prompts/providers/workflows. */
export function createRegistry<T extends { id: string }>(): Registry<T> {
  const items = new Map<string, T>()

  return {
    register(item) {
      if (items.has(item.id)) {
        throw new Error(`Registry: an item with id "${item.id}" is already registered.`)
      }
      items.set(item.id, item)
    },
    get(id) {
      return items.get(id)
    },
    list() {
      return Array.from(items.values())
    },
    has(id) {
      return items.has(id)
    },
  }
}
