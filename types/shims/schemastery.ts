export interface Schema<T = unknown> {
  (value?: unknown): T
  required(): Schema<T>
  default(value: T): Schema<T>
  min(n: number): Schema<T>
  max(n: number): Schema<T>
  step(n: number): Schema<T>
  role(role: string): Schema<T>
}

function wrap<T>(fn: (value: unknown) => T): Schema<T> {
  const schema = ((value?: unknown) => fn(value)) as Schema<T>
  schema.required = () => schema
  schema.default = () => schema
  schema.min = () => schema
  schema.max = () => schema
  schema.step = () => schema
  schema.role = () => schema
  return schema
}

const z = {
  object<T extends Record<string, Schema<unknown>>>(_shape: T): Schema<{
    [K in keyof T]: T[K] extends Schema<infer U> ? U : never
  }> {
    return wrap((value) => (value ?? {}) as never)
  },
  string(): Schema<string> {
    return wrap((value) => String(value ?? ''))
  },
  number(): Schema<number> {
    return wrap((value) => Number(value ?? 0))
  },
  boolean(): Schema<boolean> {
    return wrap((value) => Boolean(value))
  },
  union<T>(schemas: readonly Schema<T>[]): Schema<T> {
    return wrap((value) => schemas[0]?.(value) as T)
  },
  const<T>(value: T): Schema<T> {
    return wrap(() => value)
  },
}

export default z
export type { Schema as z }
