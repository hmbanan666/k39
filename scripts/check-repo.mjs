import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { skillErrors } from './check-skills.mjs'

const root = process.cwd()
const errors = []

function fail(message) {
  errors.push(message)
}

function checkAdrs() {
  const dir = join(root, 'docs/adr')
  const names = readdirSync(dir).filter((name) => name.endsWith('.md') && name !== 'README.md')
  const records = new Map()
  const redirects = []

  for (const name of names) {
    const text = readFileSync(join(dir, name), 'utf8')
    const heading = text.split('\n').find((line) => line.startsWith('#')) ?? ''
    const redirect = /^# Redirect: (\S+)\s*$/.exec(heading)
    if (redirect) {
      if (redirect[1] !== name.replace(/\.md$/, '')) {
        fail(`${name}: redirect heading must name this file`)
      }
      const link = /\]\((\d{4}-[^)]+\.md)\)/.exec(text)
      if (!link) {
        fail(`${name}: redirect must link to the record`)
      } else {
        redirects.push({ file: name, target: link[1] })
      }
      continue
    }
    const match = /^# ADR (\d{4}): \S.*$/.exec(heading)
    if (!match) {
      fail(`${name}: heading must be "# ADR NNNN: Title"`)
      continue
    }
    const number = match[1]
    if (!name.startsWith(`${number}-`)) {
      fail(`${name}: filename prefix must be ${number}`)
    }
    const previous = records.get(number)
    if (previous) {
      fail(`ADR ${number} is both ${previous} and ${name}`)
    }
    records.set(number, name)
  }

  for (const redirect of redirects) {
    if (!records.has(redirect.target.slice(0, 4)) || ![...records.values()].includes(redirect.target)) {
      fail(`${redirect.file}: target ${redirect.target} is not an ADR record`)
    }
  }

  const index = readFileSync(join(dir, 'README.md'), 'utf8')
  for (const name of records.values()) {
    if (!index.includes(`(${name})`)) {
      fail(`docs/adr/README.md does not link ${name}`)
    }
  }
  for (const redirect of redirects) {
    if (!index.includes(redirect.file)) {
      fail(`docs/adr/README.md does not mention redirect ${redirect.file}`)
    }
  }
}

function checkMigrations() {
  const dir = join(root, 'packages/database/migrations')
  const sql = readdirSync(dir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort()
  const prefixes = new Map()
  for (const name of sql) {
    const prefix = name.slice(0, 4)
    const previous = prefixes.get(prefix)
    if (previous) {
      fail(`migration prefix ${prefix} is both ${previous} and ${name}`)
    }
    prefixes.set(prefix, name)
  }

  const registry = readFileSync(join(dir, 'REGISTRY.md'), 'utf8')
  const rows = [...registry.matchAll(/^\| (\d{4}) \| ([^|]*?) \| (applied|reserved) \|$/gm)]
  const seen = new Set()
  for (const row of rows) {
    const prefix = row[1]
    const file = row[2].trim()
    const status = row[3]
    if (seen.has(prefix)) {
      fail(`REGISTRY.md lists ${prefix} twice`)
    }
    seen.add(prefix)
    if (status === 'reserved') {
      if (file) {
        fail(`REGISTRY.md reserved ${prefix} must not name a file`)
      }
      if (prefixes.has(prefix)) {
        fail(`REGISTRY.md reserves ${prefix} but ${prefixes.get(prefix)} exists`)
      }
      continue
    }
    if (prefixes.get(prefix) !== file) {
      fail(`REGISTRY.md applied ${prefix} does not match ${prefixes.get(prefix) ?? 'no sql file'}`)
    }
  }
  for (const [prefix, file] of prefixes) {
    if (!seen.has(prefix)) {
      fail(`REGISTRY.md is missing ${file}`)
    }
  }

  const journal = JSON.parse(readFileSync(join(dir, 'meta/_journal.json'), 'utf8'))
  const entries = Array.isArray(journal.entries) ? journal.entries : []
  const tags = entries.map((entry) => entry.tag)
  const tagSet = new Set(tags)
  if (tagSet.size !== tags.length) {
    fail('migration journal has a duplicate tag')
  }
  for (const file of sql) {
    const tag = file.replace(/\.sql$/, '')
    if (!tagSet.has(tag)) {
      fail(`migration journal is missing ${tag}`)
    }
  }
  for (const tag of tags) {
    if (!existsSync(join(dir, `${tag}.sql`))) {
      fail(`migration journal tag ${tag} has no sql file`)
    }
  }
  for (const message of journalOrderErrors(journal)) {
    fail(message)
  }
}

function entryName(entry, position) {
  if (entry && typeof entry.tag === 'string' && entry.tag.trim()) {
    return entry.tag.trim()
  }
  if (entry && typeof entry.idx === 'number') {
    return `idx ${entry.idx}`
  }
  return `entry ${position}`
}

function whenLabel(value) {
  return typeof value === 'number' ? `when ${value}` : 'when missing'
}

function tagPrefix(tag) {
  if (typeof tag !== 'string') {
    return null
  }
  const match = /^(\d+)/.exec(tag)
  if (!match) {
    return null
  }
  return Number(match[1])
}

function prefixLabel(tag, prefix) {
  if (prefix == null) {
    return 'no numeric prefix'
  }
  return `prefix ${String(prefix).padStart(4, '0')}`
}

/**
 * Journal order the migrator depends on.
 * `idx` is 0..n-1 in file order, `when` is strictly increasing, and each
 * tag's numeric prefix increases with that order. Each failure names both
 * entries when a pair exists.
 * @param {{ entries?: unknown }} journal
 * @returns {string[]} Messages, empty when the journal is in order.
 */
export function journalOrderErrors(journal) {
  if (!journal || typeof journal !== 'object' || !Array.isArray(journal.entries)) {
    return ['migration journal entries is not an array']
  }
  const entries = journal.entries
  const errors = []
  const byIdx = new Map()
  entries.forEach((entry, position) => {
    const name = entryName(entry, position)
    const idx = entry?.idx
    if (typeof idx !== 'number' || !Number.isInteger(idx)) {
      errors.push(`migration journal entry ${name} has no integer idx`)
      return
    }
    const previous = byIdx.get(idx)
    if (previous) {
      errors.push(`migration journal idx ${idx} is both ${previous} and ${name}`)
    } else {
      byIdx.set(idx, name)
    }
  })

  const last = entries.length - 1
  for (let position = 0; position < entries.length; position++) {
    const entry = entries[position]
    if (entry?.idx === position) {
      continue
    }
    const name = entryName(entry, position)
    const idxLabel = typeof entry?.idx === 'number' ? String(entry.idx) : 'none'
    if (position === 0) {
      const holder = byIdx.get(0)
      const expected = holder && holder !== name ? holder : 'idx 0'
      errors.push(
        `migration journal idx is not 0..${last} in file order: ${name} (idx ${idxLabel}) is first, expected ${expected}`,
      )
      continue
    }
    const previous = entries[position - 1]
    errors.push(
      `migration journal idx is not 0..${last} in file order: ${name} (idx ${idxLabel}) follows ${entryName(previous, position - 1)} (idx ${previous?.idx})`,
    )
  }

  for (let position = 1; position < entries.length; position++) {
    const previous = entries[position - 1]
    const entry = entries[position]
    const previousName = entryName(previous, position - 1)
    const name = entryName(entry, position)
    const before = previous?.when
    const after = entry?.when
    if (typeof before !== 'number' || typeof after !== 'number' || !(after > before)) {
      errors.push(
        `migration journal when is not strictly increasing: ${name} (${whenLabel(after)}) follows ${previousName} (${whenLabel(before)})`,
      )
    }
    const previousPrefix = tagPrefix(previous?.tag)
    const prefix = tagPrefix(entry?.tag)
    if (previousPrefix == null || prefix == null || !(prefix > previousPrefix)) {
      errors.push(
        `migration journal tag prefix does not increase with idx: ${name} (${prefixLabel(entry?.tag, prefix)}) follows ${previousName} (${prefixLabel(previous?.tag, previousPrefix)})`,
      )
    }
  }

  if (entries.length === 1 && tagPrefix(entries[0]?.tag) == null) {
    errors.push(
      `migration journal tag prefix does not increase with idx: ${entryName(entries[0], 0)} (${prefixLabel(entries[0]?.tag, null)})`,
    )
  }
  return errors
}

function checkTrailers() {
  const base = 'origin/main'
  try {
    execSync(`git rev-parse --verify ${base}`, { stdio: 'ignore' })
  } catch {
    if (process.env.GITHUB_ACTIONS === 'true') {
      fail(`cannot check commit trailers: ${base} is missing`)
    }
    return
  }
  const listed = execSync(`git rev-list ${base}..HEAD`, { encoding: 'utf8' }).trim()
  if (!listed) {
    return
  }
  for (const sha of listed.split('\n')) {
    const body = execSync(`git log -1 --format=%B ${sha}`, { encoding: 'utf8' })
    if (/^co-authored-by:/im.test(body)) {
      fail(`${sha.slice(0, 7)} contains a Co-authored-by trailer`)
    }
  }
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
  checkAdrs()
  checkMigrations()
  checkTrailers()
  const files = execSync('git ls-files --cached --others --exclude-standard -z', { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
  errors.push(...skillErrors(root, files))

  if (errors.length) {
    console.error(errors.join('\n'))
    process.exit(1)
  }
  console.log('repo checks passed')
}
