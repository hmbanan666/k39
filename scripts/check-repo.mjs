import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

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
  const sql = readdirSync(dir).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort()
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
  const tags = journal.entries.map((entry) => entry.tag)
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

checkAdrs()
checkMigrations()
checkTrailers()

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('repo checks passed')
