import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@deepseek-ai/cordis': new URL('./types/shims/cordis.ts', import.meta.url).pathname,
      '@deepseek-ai/schemastery': new URL('./types/shims/schemastery.ts', import.meta.url).pathname,
      '@deepseek-ai/dsh-settings': new URL('./types/shims/dsh-settings.ts', import.meta.url).pathname,
    },
  },
})
