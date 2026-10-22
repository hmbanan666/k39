import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseDocument } from 'yaml'

/** Validate shared skills and references from repository text files. */
export function skillErrors(root, files) {
  const errors = []
  const skillsRoot = '.agents/skills'
  const oldRoot = ['.cursor', 'skills'].join('/')
  const skills = readdirSync(join(root, skillsRoot), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
  if (!skills.length) {
    errors.push(`${skillsRoot}: no skills found`)
  }
  if (existsSync(join(root, oldRoot))) {
    errors.push(`${oldRoot}: keep skills only in ${skillsRoot}`)
  }

  function checkPath(file, target, base = root) {
    if (!existsSync(resolve(base, target))) {
      errors.push(`${file}: missing skill path ${target}`)
    }
  }

  for (const entry of skills) {
    const file = `${skillsRoot}/${entry.name}/SKILL.md`
    if (!existsSync(join(root, file))) {
      errors.push(`${file}: missing SKILL.md`)
      continue
    }
    const text = readFileSync(join(root, file), 'utf8')
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
    if (!frontmatter) {
      errors.push(`${file}: missing YAML frontmatter`)
      continue
    }
    const doc = parseDocument(frontmatter[1])
    if (doc.errors.length) {
      errors.push(`${file}: invalid YAML: ${doc.errors.map((error) => error.message).join('; ')}`)
      continue
    }
    const data = doc.toJS()
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      errors.push(`${file}: frontmatter must be a mapping`)
      continue
    }
    if (data.name !== entry.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name) || data.name.length > 64) {
      errors.push(`${file}: name must match its directory and use at most 64 lowercase letters, digits, or hyphens`)
    }
    if (typeof data.description !== 'string' || !data.description.trim() || data.description.length > 1024) {
      errors.push(`${file}: description must be a non-empty string of at most 1024 characters`)
    }
    for (const field of ['license', 'compatibility', 'allowed-tools']) {
      if (data[field] !== undefined && (typeof data[field] !== 'string' || !data[field].trim())) {
        errors.push(`${file}: ${field} must be a non-empty string`)
      }
    }
    if (typeof data.compatibility === 'string' && data.compatibility.length > 500) {
      errors.push(`${file}: compatibility must be at most 500 characters`)
    }
    if (data.metadata !== undefined && (!data.metadata || typeof data.metadata !== 'object'
      || Array.isArray(data.metadata) || Object.values(data.metadata).some((value) => typeof value !== 'string'))) {
      errors.push(`${file}: metadata must map strings to strings`)
    }

    // Local Markdown links and explicit bundled resource paths are skill-relative.
    const base = dirname(join(root, file))
    if (typeof data.license === 'string' && /\bLICENSE\.txt\b/.test(data.license)) {
      checkPath(file, 'LICENSE.txt', base)
    }
    for (const match of text.matchAll(/\]\(([^\s)]+)\)/g)) {
      const target = match[1].split('#')[0]
      if (target && !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(target)) {
        checkPath(file, decodeURIComponent(target), base)
      }
    }
    for (const match of text.matchAll(/`((?:\.\.?|scripts|references|assets)\/[^`\s]+|LICENSE\.txt)`/g)) {
      checkPath(file, match[1], base)
    }
    // Full repository paths in skill instructions are repository-relative.
    for (const match of text.matchAll(/`((?:docs|apps|packages|\.cursor)\/[^`\s]+)`/g)) {
      if (!/[{}<>*]/.test(match[1])) {
        checkPath(file, match[1])
      }
    }
  }

  for (const file of new Set(files)) {
    if (!/\.(?:md|mdc|[cm]?[jt]sx?|json|ya?ml)$/.test(file) || !existsSync(join(root, file)) || !statSync(join(root, file)).isFile()) {
      continue
    }
    const text = readFileSync(join(root, file), 'utf8')
    if (text.includes(`${oldRoot}/`)) {
      errors.push(`${file}: stale skill path under ${oldRoot}`)
    }
    for (const match of text.matchAll(/\.agents\/skills\/[a-z0-9][\w/.-]*/gi)) {
      checkPath(file, match[0].replace(/\.+$/, ''))
    }
  }
  return [...new Set(errors)]
}
