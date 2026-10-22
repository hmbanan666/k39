import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const app = join(root, 'apps/web-app')
const source = join(app, '.nuxt/tsconfig.server.json')
const config = JSON.parse(readFileSync(source, 'utf8'))
// Keep this file beside the generated server config so its relative paths
// still resolve. A project one directory up points #auth-utils at the wrong place.
const include = Array.isArray(config.include) ? config.include : []
const writerRoot = join(root, 'packages/database/src/repository/test')
config.include = [
  ...include,
  ...writerTestIncludes(writerRoot, dirname(source)),
]
const target = join(dirname(source), 'tsconfig.writer-test.json')
writeFileSync(target, JSON.stringify(config))

const result = spawnSync('pnpm', ['exec', 'vue-tsc', '--noEmit', '-p', target], {
  cwd: app,
  stdio: 'inherit',
})
process.exit(result.status ?? 1)

/**
 * Repository tests that import the web-app server use the `.writer.test.ts`
 * suffix. Database `tsc` excludes that glob. This project includes the same
 * glob, so a new file is typechecked without a hand-kept list.
 */
function writerTestIncludes(directory, fromDir) {
  return writerTestFiles(directory)
    .map((file) => relative(fromDir, file).replaceAll('\\', '/'))
    .sort()
}

function writerTestFiles(directory) {
  const found = []
  let entries = []
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      found.push(...writerTestFiles(path))
    } else if (entry.isFile() && entry.name.endsWith('.writer.test.ts')) {
      found.push(path)
    }
  }
  return found
}
