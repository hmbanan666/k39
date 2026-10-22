import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = join(root, 'apps/web-app')
const source = join(app, '.nuxt/tsconfig.server.json')
const config = JSON.parse(readFileSync(source, 'utf8'))
// Keep this file beside the generated server config so its relative paths
// still resolve. A project one directory up points #auth-utils at the wrong place.
const include = Array.isArray(config.include) ? config.include : []
config.include = [
  ...include,
  '../../../packages/database/src/repository/test/pending-publish.test.ts',
  '../../../packages/database/src/repository/test/media-ingest.test.ts',
  '../../../packages/database/src/repository/test/pending-collection-route.test.ts',
  '../../../packages/database/src/repository/test/place-contact.test.ts',
]
const target = join(dirname(source), 'tsconfig.writer-test.json')
writeFileSync(target, JSON.stringify(config))

const result = spawnSync('pnpm', ['exec', 'vue-tsc', '--noEmit', '-p', target], {
  cwd: app,
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
