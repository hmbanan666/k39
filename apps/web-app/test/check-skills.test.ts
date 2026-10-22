import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { skillErrors } from '../../../scripts/check-skills.mjs'

const roots: string[] = []
const skillsRoot = ['.agents', 'skills'].join('/')
const base = `${skillsRoot}/example`
const skill = `${base}/SKILL.md`
const valid = '---\nname: example\ndescription: Use for the example workflow.\nlicense: Complete terms in LICENSE.txt\n---\n'

function fixture(text = valid) {
  const root = mkdtempSync(join(tmpdir(), 'k39-skills-'))
  roots.push(root)
  function write(file: string, content = '') {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), content)
  }
  write(skill, text)
  write(`${base}/LICENSE.txt`, 'Example license')
  return { root, write }
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

describe('shared Agent Skills checks', () => {
  it('accepts YAML block descriptions, bundled resources, and repository references', () => {
    const frontmatter = valid.replace('description: Use for the example workflow.', 'description: >\n  Use for the\n  example workflow.')
    const { root, write } = fixture(frontmatter)
    write('AGENTS.md', `Read \`${skill}\`. Template: \`.agents/skills/<name>/SKILL.md\`.`)
    write(`${base}/references/guide.md`)
    write(`${base}/scripts/run.sh`)
    write('docs/example.md')
    write(skill, `${frontmatter}\n[Guide](references/guide.md#start)\nRun \`scripts/run.sh\`. Read \`docs/example.md\`. [External](https://example.com).`)
    expect(skillErrors(root, ['AGENTS.md', skill])).toEqual([])
  })

  it.each([
    ['no frontmatter', '# Example', 'missing YAML frontmatter'],
    ['malformed YAML', '---\nname: [\n---\n', 'invalid YAML'],
    ['duplicate keys', '---\nname: example\nname: other\n---\n', 'invalid YAML'],
    ['wrong name', valid.replace('name: example', 'name: another'), 'name must match'],
    ['non-string description', valid.replace('description: Use for the example workflow.', 'description: true'), 'description must be'],
    ['empty description', valid.replace('description: Use for the example workflow.', 'description: ""'), 'description must be'],
  ])('rejects %s', (_, text, message) => {
    const { root } = fixture(text)
    expect(skillErrors(root, [skill]).join('\n')).toContain(message)
  })

  it('reports missing resources, repository paths, and skill references from Cursor rules', () => {
    const { root, write } = fixture(`${valid}\n[Guide](references/missing.md)\nRead \`docs/missing.md\`. Run \`scripts/missing.sh\`.`)
    rmSync(join(root, `${base}/LICENSE.txt`))
    write('.cursor/rules/example.mdc', `Read ${skillsRoot}/missing/SKILL.md.`)
    const errors = skillErrors(root, [skill, '.cursor/rules/example.mdc']).join('\n')
    for (const path of ['references/missing.md', 'docs/missing.md', 'scripts/missing.sh', 'LICENSE.txt', `${skillsRoot}/missing/SKILL.md`]) {
      expect(errors).toContain(`missing skill path ${path}`)
    }
  })

  it('rejects the old skill directory and old paths even when they still exist', () => {
    const { root, write } = fixture()
    const oldRoot = ['.cursor', 'skills'].join('/')
    write(`${oldRoot}/example/SKILL.md`, valid)
    write('AGENTS.md', `Read ${oldRoot}/example/SKILL.md`)
    const errors = skillErrors(root, ['AGENTS.md']).join('\n')
    expect(errors).toContain('keep skills only in .agents/skills')
    expect(errors).toContain('stale skill path')
  })
})
