import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { planNodePath } from '../../../scripts/env/node-path-plan.mjs'
import { findDispatcher, linkMissingHooks } from '../../../scripts/git/chain-hooks.mjs'

function repoRoot() {
  const candidates = [process.cwd(), resolve(process.cwd(), '../..')]
  return candidates.find((dir) => existsSync(resolve(dir, 'pnpm-workspace.yaml'))) ?? process.cwd()
}

const syncScript = resolve(repoRoot(), 'scripts/git/sync-branch.sh')
const bootScript = resolve(repoRoot(), 'scripts/env/check-boot.sh')
const migrateScript = resolve(repoRoot(), 'scripts/env/migrate-dev.sh')
const nodePathScript = resolve(repoRoot(), 'scripts/env/node-path.sh')
const dirs: string[] = []

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'k39-tooling-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'K39',
  GIT_AUTHOR_EMAIL: 'dev@localhost',
  GIT_COMMITTER_NAME: 'K39',
  GIT_COMMITTER_EMAIL: 'dev@localhost',
  GIT_TERMINAL_PROMPT: '0',
}

function git(cwd: string, args: string[]) {
  return execFileSync('git', args, { cwd, env: gitEnv, encoding: 'utf8' }).trim()
}

function seedPair() {
  const root = scratch()
  const origin = join(root, 'origin.git')
  const seed = join(root, 'seed')
  const work = join(root, 'work')
  git(root, ['init', '--bare', '-b', 'main', origin])
  git(root, ['init', '-b', 'main', seed])
  git(seed, ['config', 'core.hooksPath', join(seed, '.git/hooks')])
  writeFileSync(join(seed, 'readme.txt'), 'one\n')
  git(seed, ['add', 'readme.txt'])
  git(seed, ['commit', '-m', 'feat: one'])
  git(seed, ['remote', 'add', 'origin', origin])
  git(seed, ['push', '-u', 'origin', 'main'])
  git(root, ['clone', origin, work])
  git(work, ['config', 'user.email', 'dev@localhost'])
  git(work, ['config', 'user.name', 'K39'])
  git(work, ['config', 'core.hooksPath', join(work, '.git/hooks')])
  return { origin, seed, work }
}

describe('node path plan', () => {
  it('links only the directories before the platform node', () => {
    expect(planNodePath('/usr/local/cargo/bin:/exec-daemon:/usr/local/bin')).toEqual({
      link: ['/usr/local/cargo/bin'],
      platform: true,
    })
    expect(planNodePath('/exec-daemon:/usr/local/bin')).toEqual({
      link: [],
      platform: true,
    })
    expect(planNodePath('/usr/local/bin:/usr/bin')).toEqual({
      link: [],
      platform: false,
    })
  })
})

describe('node path links', () => {
  const tools = ['node', 'npm', 'npx', 'corepack', 'pnpm', 'pnpx']

  function writeTools(dir: string) {
    mkdirSync(dir, { recursive: true })
    for (const name of tools) {
      const path = join(dir, name)
      writeFileSync(path, '#!/bin/sh\necho ok\n')
      chmodSync(path, 0o755)
    }
  }

  function linkInto(source: string, dest: string) {
    execFileSync('bash', [nodePathScript, '--link-into', source, dest], { encoding: 'utf8' })
  }

  it('does not replace a tool with a symlink to itself', () => {
    const bin = join(scratch(), 'bin')
    writeTools(bin)
    linkInto(bin, bin)
    for (const name of tools) {
      expect(lstatSync(join(bin, name)).isSymbolicLink()).toBe(false)
    }
  })

  it('does not relink when the destination directory is another path to the source', () => {
    const root = scratch()
    const source = join(root, 'src')
    const alias = join(root, 'alias')
    writeTools(source)
    symlinkSync(source, alias)
    linkInto(source, alias)
    for (const name of ['npm', 'npx', 'corepack', 'pnpm']) {
      expect(lstatSync(join(source, name)).isSymbolicLink()).toBe(false)
    }
  })

  it('links tools into a different directory', () => {
    const root = scratch()
    const source = join(root, 'src')
    const dest = join(root, 'dest')
    writeTools(source)
    mkdirSync(dest)
    linkInto(source, dest)
    expect(lstatSync(join(dest, 'pnpm')).isSymbolicLink()).toBe(true)
    expect(readlinkSync(join(dest, 'pnpm'))).toBe(join(source, 'pnpm'))
    expect(lstatSync(join(source, 'pnpm')).isSymbolicLink()).toBe(false)
  })
})

describe('hook dispatcher', () => {
  it('prefers the workspace dispatcher over another hooks directory', () => {
    const home = scratch()
    const workspace = '/workspace'
    const encoded = Buffer.from(workspace).toString('base64').replace(/=+$/g, '')
    const preferred = join(home, '.cursor', 'agent-hooks', encoded)
    const other = join(home, '.cursor', 'agent-hooks', 'other')
    mkdirSync(preferred, { recursive: true })
    mkdirSync(other, { recursive: true })
    writeFileSync(join(other, '.dispatcher'), '')
    writeFileSync(join(preferred, '.dispatcher'), '')
    expect(findDispatcher(home, workspace, other)).toBe(preferred)
    rmSync(join(preferred, '.dispatcher'))
    expect(findDispatcher(home, workspace, other)).toBe(other)
    rmSync(join(other, '.dispatcher'))
    expect(findDispatcher(home, workspace, other)).toBeNull()
  })
})

describe('hook links', () => {
  it('adds a post-commit name the cloud dispatcher does not ship', () => {
    const root = scratch()
    const husky = join(root, '.husky')
    const dispatcher = join(root, 'dispatcher')
    mkdirSync(husky)
    mkdirSync(dispatcher)
    writeFileSync(join(husky, 'post-commit'), '#!/bin/sh\n')
    writeFileSync(join(husky, 'pre-commit'), '#!/bin/sh\n')
    writeFileSync(join(dispatcher, '.dispatcher'), '')
    symlinkSync('.dispatcher', join(dispatcher, 'commit-msg'))
    expect(linkMissingHooks(husky, dispatcher).sort()).toEqual(['post-commit', 'pre-commit'])
    expect(readlinkSync(join(dispatcher, 'post-commit'))).toBe('.dispatcher')
    expect(linkMissingHooks(husky, dispatcher)).toEqual([])
    expect(lstatSync(join(dispatcher, 'commit-msg')).isSymbolicLink()).toBe(true)
  })
})

describe('sync branch', { timeout: 60_000 }, () => {
  it('fast-forwards when origin is ahead', () => {
    const { seed, work } = seedPair()
    writeFileSync(join(seed, 'readme.txt'), 'two\n')
    git(seed, ['commit', '-am', 'feat: two'])
    git(seed, ['push', 'origin', 'main'])
    const before = git(work, ['rev-parse', 'HEAD'])
    execFileSync('bash', [syncScript], { cwd: work, env: gitEnv, encoding: 'utf8' })
    const after = git(work, ['rev-parse', 'HEAD'])
    expect(after).not.toBe(before)
    expect(after).toBe(git(seed, ['rev-parse', 'HEAD']))
  })

  it('leaves a branch that has local commits', () => {
    const { work } = seedPair()
    writeFileSync(join(work, 'local.txt'), 'local\n')
    git(work, ['add', 'local.txt'])
    git(work, ['commit', '-m', 'feat: local'])
    const before = git(work, ['rev-parse', 'HEAD'])
    execFileSync('bash', [syncScript], { cwd: work, env: gitEnv, encoding: 'utf8' })
    expect(git(work, ['rev-parse', 'HEAD'])).toBe(before)
  })

  it('fetches and stays when the current branch has no remote', () => {
    const { work } = seedPair()
    git(work, ['checkout', '-b', 'cursor/local-only'])
    const before = git(work, ['rev-parse', 'HEAD'])
    execFileSync('bash', [syncScript], { cwd: work, env: gitEnv, encoding: 'utf8' })
    expect(git(work, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('cursor/local-only')
    expect(git(work, ['rev-parse', 'HEAD'])).toBe(before)
  })

  it('fast-forwards a branch with no commits of its own to the base ref', () => {
    const { seed, work } = seedPair()
    git(work, ['checkout', '-b', 'cursor/stale'])
    writeFileSync(join(seed, 'readme.txt'), 'two\n')
    git(seed, ['commit', '-am', 'feat: two'])
    git(seed, ['push', 'origin', 'main'])
    execFileSync('bash', [syncScript, 'origin/main'], { cwd: work, env: gitEnv, encoding: 'utf8' })
    expect(git(work, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe('cursor/stale')
    expect(git(work, ['rev-parse', 'HEAD'])).toBe(git(seed, ['rev-parse', 'HEAD']))
  })

  it('does not reset a branch that has its own commits', () => {
    const { seed, work } = seedPair()
    git(work, ['checkout', '-b', 'cursor/stale'])
    writeFileSync(join(work, 'local.txt'), 'local\n')
    git(work, ['add', 'local.txt'])
    git(work, ['commit', '-m', 'feat: local'])
    const before = git(work, ['rev-parse', 'HEAD'])
    writeFileSync(join(seed, 'readme.txt'), 'two\n')
    git(seed, ['commit', '-am', 'feat: two'])
    git(seed, ['push', 'origin', 'main'])
    execFileSync('bash', [syncScript, 'origin/main'], { cwd: work, env: gitEnv, encoding: 'utf8' })
    expect(git(work, ['rev-parse', 'HEAD'])).toBe(before)
  })

  it('does not move a dirty worktree onto the base ref', () => {
    const { seed, work } = seedPair()
    git(work, ['checkout', '-b', 'cursor/stale'])
    const before = git(work, ['rev-parse', 'HEAD'])
    writeFileSync(join(seed, 'readme.txt'), 'two\n')
    git(seed, ['commit', '-am', 'feat: two'])
    git(seed, ['push', 'origin', 'main'])
    writeFileSync(join(work, 'dirty.txt'), 'dirty\n')
    execFileSync('bash', [syncScript, 'origin/main'], { cwd: work, env: gitEnv, encoding: 'utf8' })
    expect(git(work, ['rev-parse', 'HEAD'])).toBe(before)
    expect(existsSync(join(work, 'dirty.txt'))).toBe(true)
  })
})

describe('boot self-check', () => {
  function executable(dir: string, name: string, body: string) {
    const path = join(dir, name)
    writeFileSync(path, body)
    chmodSync(path, 0o755)
    return path
  }

  function runBoot(pathDir: string, profile: string) {
    try {
      const stdout = execFileSync('/bin/bash', [bootScript], {
        cwd: repoRoot(),
        env: { ...process.env, PATH: pathDir, K39_BOOT_PROFILE: profile },
        encoding: 'utf8',
      })
      return { status: 0, stdout }
    } catch (error) {
      const failed = error as { status?: number, stdout?: string }
      return { status: failed.status ?? 1, stdout: failed.stdout ?? '' }
    }
  }

  it('names a missing node, postgres, and profile', () => {
    const bin = scratch()
    const version = readFileSync(resolve(repoRoot(), '.nvmrc'), 'utf8').trim()
    executable(bin, 'node', '#!/bin/sh\necho v22.0.0\n')
    const profile = join(scratch(), 'k39.sh')
    const result = runBoot(bin, profile)
    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('boot check failed:')
    expect(result.stdout).toContain(`want v${version} from .nvmrc`)
    expect(result.stdout).toContain('pg_isready is not on PATH')
    expect(result.stdout).toContain(`${profile} is missing`)
  })

  it('passes when node, postgres 18, and the profile are present', () => {
    const bin = scratch()
    const version = readFileSync(resolve(repoRoot(), '.nvmrc'), 'utf8').trim()
    executable(bin, 'node', `#!/bin/sh\necho v${version}\n`)
    executable(bin, 'pg_isready', '#!/bin/sh\nexit 0\n')
    executable(bin, 'pg_lsclusters', '#!/bin/sh\necho "18 main 5432 online postgres /tmp /tmp"\n')
    executable(bin, 'psql', '#!/bin/sh\ncase "$*" in *public.places*) echo places ;; esac\nexit 0\n')
    const profile = join(scratch(), 'k39.sh')
    writeFileSync(profile, 'export PATH="/usr/local/bin:$PATH"\n')
    const result = runBoot(bin, profile)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(`boot check passed: node v${version}, postgres 18, public.places, ${profile}`)
  })

  it('names a dev database that has no places table', () => {
    const bin = scratch()
    const version = readFileSync(resolve(repoRoot(), '.nvmrc'), 'utf8').trim()
    executable(bin, 'node', `#!/bin/sh\necho v${version}\n`)
    executable(bin, 'pg_isready', '#!/bin/sh\nexit 0\n')
    executable(bin, 'pg_lsclusters', '#!/bin/sh\necho "18 main 5432 online postgres /tmp /tmp"\n')
    executable(bin, 'psql', '#!/bin/sh\nexit 0\n')
    const profile = join(scratch(), 'k39.sh')
    writeFileSync(profile, 'export PATH="/usr/local/bin:$PATH"\n')
    const result = runBoot(bin, profile)
    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('has no public.places')
    expect(result.stdout).toContain('scripts/env/migrate-dev.sh')
  })
})

describe('dev database migrate', () => {
  function executable(dir: string, name: string, body: string) {
    const path = join(dir, name)
    writeFileSync(path, body)
    chmodSync(path, 0o755)
    return path
  }

  function runMigrate(databaseUrl: string, pathDir: string) {
    try {
      execFileSync('/bin/bash', [migrateScript], {
        cwd: repoRoot(),
        env: { ...process.env, PATH: pathDir, DATABASE_URL: databaseUrl },
        encoding: 'utf8',
      })
      return { status: 0, stderr: '' }
    } catch (error) {
      const failed = error as { status?: number, stderr?: string }
      return { status: failed.status ?? 1, stderr: failed.stderr ?? '' }
    }
  }

  it('refuses a remote host and a test database name', () => {
    const bin = scratch()
    const record = join(bin, 'called')
    executable(bin, 'corepack', `#!/bin/sh\necho called >> '${record}'\nexit 0\n`)
    const remote = runMigrate('postgres://k39:k39@db.example.com:5432/k39', bin)
    expect(remote.status).not.toBe(0)
    expect(remote.stderr).toContain('refusing host db.example.com')
    const testDb = runMigrate('postgres://k39:k39@127.0.0.1:5432/k39_test', bin)
    expect(testDb.status).not.toBe(0)
    expect(testDb.stderr).toContain('refusing database k39_test')
    expect(existsSync(record)).toBe(false)
  })

  it('runs drizzle-kit migrate for the local dev database', () => {
    const bin = scratch()
    const record = join(bin, 'called')
    executable(bin, 'corepack', `#!/bin/sh\necho "$@" >> '${record}'\nexit 0\n`)
    const result = runMigrate('postgres://k39:k39@127.0.0.1:5432/k39', bin)
    expect(result.status).toBe(0)
    expect(readFileSync(record, 'utf8')).toContain('--filter @k39/database db:migrate')
  })
})
