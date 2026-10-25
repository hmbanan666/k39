import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
await build({
  configFile: false,
  root,
  ssr: { noExternal: [/^@k39\//], external: ['pg'] },
  build: {
    ssr: 'apps/web-app/scripts/report-source-lists.ts',
    target: 'node24',
    outDir: 'apps/web-app/.output/server/audits',
    emptyOutDir: true,
    minify: false,
    rolldownOptions: { output: { entryFileNames: 'report-source-lists.mjs' } },
  },
})
