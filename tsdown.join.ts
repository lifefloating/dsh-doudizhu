import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

const config: UserConfig = {
  name: 'dsh-doudizhu/join',
  tsconfig: 'tsconfig.client.json',
  entry: { index: 'src/join/main.tsx' },
  outDir: 'lib/join',
  format: 'iife',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: [],
  noExternal: () => true,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  plugins: [{
    name: 'dsh-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css') && !source.endsWith('.css')) return null
      const abs = importer ? new URL(source, `file://${importer}`).pathname : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const isModule = fileId.endsWith('.module.css')
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: isModule ? { pattern: '[hash]_[local]' } : undefined,
        minify: true,
      })
      const classMap: Record<string, string> = {}
      if (isModule) {
        for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
      }
      return [
        `const css = ${JSON.stringify(code.toString())};`,
        `const tagId = ${JSON.stringify(`dsh-doudizhu-join/${basename(fileId)}`)};`,
        'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
        '  const tag = document.createElement(\'style\');',
        '  tag.dataset.plugin = \'dsh-doudizhu-join\';',
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classMap)};`,
      ].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'index.js',
    name: 'DouDizhuJoin',
  },
  copy: [
    { from: 'src/join/join.html', to: 'lib/join/index.html' },
    { from: 'src/client/assets/card-back-whale.svg', to: 'lib/join/card-back-whale.svg' },
    { from: 'src/client/assets/join.css', to: 'lib/join/join.css' },
  ],
}

export default config
