import { realpathSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const PLATFORM_DIRS = new Set(['/exec-daemon', '/exec-daemon/tools'])

/**
 * Directories searched before the platform Node.
 * Agent shells are not login shells, and the platform prepends /exec-daemon
 * (Node 22) to PATH, so /usr/local/bin alone never wins.
 * When the platform directory is first, nothing can be linked ahead of it
 * and the boot script installs a dispatcher in front of that binary.
 */
export function planNodePath(pathValue) {
  const link = []
  let sawPlatform = false
  for (const dir of String(pathValue ?? '').split(':')) {
    if (!dir) {
      continue
    }
    if (PLATFORM_DIRS.has(dir)) {
      sawPlatform = true
      break
    }
    link.push(dir)
  }
  if (!sawPlatform) {
    return { link: [], platform: false }
  }
  return { link, platform: true }
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) {
    return false
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href
  } catch {
    return false
  }
}

if (isDirectRun()) {
  const plan = planNodePath(process.env.PATH)
  if (process.argv.includes('--platform')) {
    process.stdout.write(plan.platform ? 'yes\n' : 'no\n')
  } else {
    process.stdout.write(plan.link.length ? `${plan.link.join('\n')}\n` : '')
  }
}
