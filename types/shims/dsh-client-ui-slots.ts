export interface SlotMap {
  'sidebar.footer.action': { kind: 'list'; scope: 'root'; owner: { wide: boolean } }
  'shell.overlay': { kind: 'list'; scope: 'root'; owner: Record<string, never> }
  'settings.plugin.item': { kind: 'keyed'; scope: 'root'; owner: { children?: never } }
}

export type PropsRuntime<_Name extends string> = Record<string, never>

export type InjectFace<T> = T

export interface LocaleNamespaceMap {
  [key: string]: string
}
