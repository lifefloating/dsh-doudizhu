export interface ClientContext {
  slots: {
    inject(name: string, factory: () => unknown): () => void
    register(options: Record<string, unknown>, component: unknown): () => void
  }
  settingsScope: {
    bind<T>(spec: { namespace: string }): SettingsScope<T>
  }
  effect(fn: () => (() => void) | void): () => void
}

export interface SettingsScopeSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable'
  value: T | undefined
  base: Partial<T> | undefined
  user: Partial<T> | undefined
  revision: number | undefined
  writable: boolean
}

export interface SettingsScope<T> {
  getSnapshot(): SettingsScopeSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
  unset(field: string): Promise<void>
}

export interface SnapshotStore<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

export function createSnapshotStore<T>(initial: T): SnapshotStore<T> & { set(next: T): void } {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next) => {
      value = next
      for (const listener of listeners) listener()
    },
  }
}
