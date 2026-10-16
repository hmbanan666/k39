import type { Plugin } from 'vite'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COMPONENTS = join(ROOT, 'app/components')
const STUB = join(ROOT, 'test/nuxt-stubs.ts')
const AUTO_DIRS = [join(ROOT, 'app/composables'), join(ROOT, 'app/utils')]

const VUE_APIS = ['computed', 'inject', 'nextTick', 'onBeforeMount', 'onBeforeUnmount', 'onMounted', 'onUnmounted', 'onUpdated', 'provide', 'reactive', 'readonly', 'ref', 'shallowRef', 'toRef', 'toRefs', 'unref', 'useAttrs', 'useId', 'useSlots', 'useTemplateRef', 'watch', 'watchEffect']
const NUXT_APIS = ['definePageMeta', 'navigateTo', 'useFetch', 'useHead', 'useRoute', 'useRouter', 'useRuntimeConfig', 'useSeoMeta', 'useState', 'useUserSession']
const STUB_COMPONENTS = ['ClientOnly', 'Icon', 'MapEmbed', 'NuxtLink']

function walk(dir: string, extension: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      walk(path, extension, out)
    } else if (name.endsWith(extension)) {
      out.push(path)
    }
  }
  return out
}

function splitByCase(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s/_-]+/).filter(Boolean)
}

/** Same names Nuxt gives `app/components`, including the ui/ prefix collapse. */
function nuxtComponentName(rel: string) {
  const parts = rel.replace(/\.vue$/, '').split('/')
  const file = parts.pop() ?? ''
  const prefixParts = parts.flatMap((part) => splitByCase(part))
  const fileParts = splitByCase(file)
  const fileContent = fileParts.join('/').toLowerCase()
  const nameParts = [...prefixParts]
  const matched: string[] = []
  for (let index = prefixParts.length - 1; index >= 0; index -= 1) {
    matched.unshift(...splitByCase(prefixParts[index] ?? '').map((part) => part.toLowerCase()))
    const suffix = matched.join('/')
    if (fileContent === suffix || fileContent.startsWith(`${suffix}/`)) {
      nameParts.length = index
    }
  }
  return [...nameParts, ...fileParts].map((part) => part[0]!.toUpperCase() + part.slice(1)).join('')
}

function autoImports() {
  const names = new Map<string, string>()
  for (const dir of AUTO_DIRS) {
    let entries: string[] = []
    try {
      entries = walk(dir, '.ts')
    } catch {
      entries = []
    }
    for (const file of entries) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z_]\w*)/g)) {
        const name = match[1]
        if (name) {
          names.set(name, file)
        }
      }
    }
  }
  return names
}

function componentNames() {
  const names = new Map<string, string>()
  for (const file of walk(COMPONENTS, '.vue')) {
    const rel = relative(COMPONENTS, file)
    names.set(nuxtComponentName(rel), file)
  }
  return names
}

function outerTemplate(code: string) {
  const start = code.indexOf('<template>')
  const end = code.lastIndexOf('</template>')
  if (start < 0 || end < start) {
    return ''
  }
  return code.slice(start + '<template>'.length, end)
}

function used(script: string, name: string) {
  return new RegExp(`\\b${name}\\b`).test(script)
}

function imported(script: string, name: string) {
  const pattern = new RegExp(`\\b${name}\\b`)
  let statement = ''
  let open = false
  for (const line of script.split('\n')) {
    if (!open && line.trimStart().startsWith('import ')) {
      open = true
      statement = line
    } else if (open) {
      statement += `\n${line}`
    }
    if (open && statement.includes(' from ')) {
      if (pattern.test(statement)) {
        return true
      }
      open = false
      statement = ''
    }
  }
  return false
}

function transformTypeScript(file: string, code: string) {
  const needed = ['computed', 'ref', 'useRoute', 'useRouter', 'useState', 'useNuxtApp', 'useHead', 'useRuntimeConfig', 'navigateTo'].filter((name) => used(code, name) && !imported(code, name))
  if (!needed.length) {
    return null
  }
  const vue = needed.filter((name) => name === 'computed' || name === 'ref')
  const nuxt = needed.filter((name) => !vue.includes(name))
  const lines: string[] = []
  if (vue.length) {
    lines.push(`import { ${vue.join(', ')} } from 'vue'`)
  }
  if (nuxt.length) {
    lines.push(`import { ${nuxt.join(', ')} } from '${specifier(file, STUB)}'`)
  }
  return { code: `${lines.join('\n')}\n${code}`, map: null }
}

function specifier(fromFile: string, target: string) {
  let rel = relative(dirname(fromFile), target).replaceAll('\\', '/')
  if (!rel.startsWith('.')) {
    rel = `./${rel}`
  }
  return rel
}

/** Give Vitest the Vue and component imports Nuxt would inject, so a page can SSR without a database. */
export function nuxtSfcTestPlugin(): Plugin {
  const components = componentNames()
  const autos = autoImports()
  return {
    name: 'k39-nuxt-sfc-test',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0] ?? id
      if (file.endsWith('.ts') && AUTO_DIRS.some((dir) => file.startsWith(dir))) {
        return transformTypeScript(file, code)
      }
      if (!file.endsWith('.vue')) {
        return null
      }
      const match = code.match(/<script\s+setup([^>]*)>([\s\S]*?)<\/script>/)
      if (!match) {
        return null
      }
      const script = match[2] ?? ''
      const template = outerTemplate(code)
      const tags = [...template.matchAll(/<([A-Z][A-Za-z0-9]+)/g)].map((item) => item[1] ?? '')
      const lines: string[] = []
      const vue = VUE_APIS.filter((name) => used(script, name) && !imported(script, name))
      if (vue.length) {
        lines.push(`import { ${vue.join(', ')} } from 'vue'`)
      }
      const nuxt = NUXT_APIS.filter((name) => used(script, name) && !imported(script, name))
      const stubs = [...new Set(tags.filter((tag) => STUB_COMPONENTS.includes(tag) && !imported(script, tag)))]
      if (nuxt.length || stubs.length) {
        lines.push(`import { ${[...nuxt, ...stubs].join(', ')} } from '${specifier(file, STUB)}'`)
      }
      for (const [name, target] of autos) {
        if (used(script, name) && !imported(script, name)) {
          lines.push(`import { ${name} } from '${specifier(file, target)}'`)
        }
      }
      for (const tag of new Set(tags)) {
        if (!tag || STUB_COMPONENTS.includes(tag) || imported(script, tag)) {
          continue
        }
        const target = components.get(tag)
        if (target && target !== file) {
          lines.push(`import ${tag} from '${specifier(file, target)}'`)
        }
      }
      if (!lines.length) {
        return null
      }
      const next = code.replace(match[0], `<script setup${match[1]}>\n${lines.join('\n')}\n${script}</script>`)
      return { code: next, map: null }
    },
  }
}
