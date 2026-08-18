import type { Context } from '@deepseek-ai/cordis'

export type SettingsNamespace = string & { readonly __ns: unique symbol }

export function settingsNamespace(value: string): SettingsNamespace {
  return value as SettingsNamespace
}

export interface SettingsSectionHooks<T> {
  setSource(current: () => T): void
  onChange(): void
  validate?: (value: T) => void
}

export function installSettingsSection<T>(
  _ctx: Context,
  _ns: SettingsNamespace,
  _schema: unknown,
  _entry: T,
  hooks: SettingsSectionHooks<T>,
): void {
  hooks.setSource(() => _entry)
}
