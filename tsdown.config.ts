import type { UserConfig } from 'tsdown'

const config: UserConfig = {
  name: 'dsh-poker',
  entry: {
    index: 'src/index.ts',
    invariant: 'src/invariant.ts',
  },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: false,
  clean: false,
  sourcemap: true,
  external: [
    '@deepseek-ai/cordis',
    '@deepseek-ai/schemastery',
    '@deepseek-ai/dsh-settings',
    'ws',
    'zod',
    /^node:/,
  ],
}

export default config
