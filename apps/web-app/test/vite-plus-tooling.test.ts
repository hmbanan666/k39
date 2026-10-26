import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../..')
const vp = join(root, 'node_modules/.bin/vp')
const config = join(root, 'vite.config.ts')

function run(args: string[]) {
  return spawnSync(vp, args, { cwd: root, encoding: 'utf8', timeout: 20_000 })
}

describe('Vite+ and Vue compatibility', () => {
  it.each([
    [
      '<template><div v-for="item in items">{{ item }}</div></template><script setup lang="ts">const items = [1]</script>',
      'vue/require-v-for-key',
    ],
    ['<template><input v-model="1" /></template>', 'vue/valid-v-model'],
    ['<script setup lang="ts">const value = 1</script><template>{{ value }}</template>', 'vue/block-order'],
    [
      '<template><input v-model="props.title" /></template><script setup lang="ts">const props = defineProps<{ title: string }>()</script>',
      'vue/no-mutating-props',
    ],
  ])('retains semantic Vue checks: %s', async (source, rule) => {
    const eslint = new ESLint({ cwd: root })
    const [result] = await eslint.lintText(source, { filePath: 'apps/web-app/app/components/ToolchainProbe.vue' })
    expect(result?.messages.map((message) => message.ruleId)).toContain(rule)
  })

  it('accepts a typed Vue template in the required block order', async () => {
    const eslint = new ESLint({ cwd: root })
    const [result] = await eslint.lintText(
      '<template><div v-for="item in items" :key="item">{{ item }}</div></template><script setup lang="ts">const items: number[] = [1]</script>',
      { filePath: 'apps/web-app/app/components/ToolchainProbe.vue' },
    )
    expect(result?.errorCount).toBe(0)
  })

  it('keeps checks read-only and writes only with explicit lint/fmt fixes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'k39-vite-plus-'))
    const file = join(dir, 'probe.ts')
    const original = 'export function double(value: number){if(value) return value*2;return 0;}\n'
    writeFileSync(file, original)
    try {
      const lint = run(['lint', '--config', config, file])
      expect(lint.status, lint.stderr).toBe(1)
      expect(lint.stdout + lint.stderr).toContain('curly')
      const format = run(['fmt', '--config', config, '--check', file])
      expect(format.status, format.stderr).toBe(1)
      expect(readFileSync(file, 'utf8')).toBe(original)

      const fixed = run(['lint', '--config', config, '--fix', file])
      expect(fixed.status, fixed.stdout + fixed.stderr).toBe(0)
      expect(readFileSync(file, 'utf8')).not.toBe(original)
      const formatted = run(['fmt', '--config', config, file])
      expect(formatted.status, formatted.stderr).toBe(0)
      const clean = readFileSync(file, 'utf8')
      expect(run(['fmt', '--config', config, '--check', file]).status).toBe(0)
      expect(run(['lint', '--config', config, file]).status).toBe(0)
      expect(readFileSync(file, 'utf8')).toBe(clean)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30_000)
})
