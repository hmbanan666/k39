import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'
import { createServer } from 'vite'
import { nuxtSfcTestPlugin } from '../../../apps/web-app/test/nuxt-sfc-plugin.ts'

async function main() {
  const root = process.cwd()
  const output = resolve(root, 'docs/reviews/2026-10-23-search-failure')
  const scratch = await mkdtemp(resolve(tmpdir(), 'k39-search-review-'))
  const baseline = 'ac3da9500118a5a5bcec60c7a7e542b331d73b60'
  const before = resolve(scratch, 'before.vue')
  await writeFile(before, execFileSync('git', ['show', `${baseline}:apps/web-app/app/pages/poisk.vue`]))
  const builtCss = resolve(root, 'apps/web-app/.output/public/_nuxt')
  const entry = (await readdir(builtCss)).find((name) => /^entry\..*\.css$/.test(name))
  assert(entry, 'Build first for production fonts')
  const fonts = ((await readFile(resolve(builtCss, entry), 'utf8')).match(/@font-face\{[^}]+\}/g) || []).join('\n').replaceAll('/_fonts/', `/@fs/${root}/apps/web-app/.output/public/_fonts/`)
  const server = await createServer({
    configFile: false, root, publicDir: resolve(root, 'apps/web-app/public'),
    resolve: { alias: [
      { find: '~~', replacement: resolve(root, 'apps/web-app') },
      { find: '~', replacement: resolve(root, 'apps/web-app/app') },
    ] },
    plugins: [{
      name: 'search-review', enforce: 'pre',
      resolveId(id, importer) {
        if (importer === before || importer === resolve(root, 'apps/web-app/app/pages/poisk.vue')) {
          if (id.endsWith('nuxt-stubs.ts')) {
            return '\0search-review-nuxt'
          }
          if (id === '~~/shared/search' || id.endsWith('/shared/search') || id.endsWith('/shared/search.ts')) {
            return '\0search-review-events'
          }
        }
      },
      load(id) {
        if (id === '\0search-review-nuxt') {
          return `export * from '/apps/web-app/test/nuxt-stubs.ts';
import { reactive, ref } from 'vue';
const route = reactive({query:{q:'Форт', s:'page'}});
const data = ref(null), status = ref('error'), error = ref(new Error('Fixture: API unavailable'));
function setState(state) {
  status.value = state;
  error.value = state === 'error' ? new Error('Fixture: API unavailable') : null;
  if (state === 'success' || state === 'empty') {
    status.value = 'success';
    data.value = {query:route.query.q, normalized:'форт', results:state === 'empty' ? [] : [{kind:'place', path:'/fixture-fort',title:'Фикстура: форт',label:'Форты',region:'Калининград',snippet:'Тестовый результат после повторной попытки.'}]};
  }
}
window.review = {events:[], retryCalls:0, setState, finish:null};
function refresh() {
  window.review.retryCalls++; setState('pending');
  return new Promise(resolve => {window.review.finish = () => {setState('success'); resolve()}});
}
export function useRoute() { return route }
export function useFetch(url) {
  return url === '/api/search' ? {data,status,error,refresh} : {data:ref({hubs:[{text:'Форты',href:'/forty'},{text:'Замки',href:'/zamki'}],places:[{text:'Фикстура: место',href:'/fixture-place'}],routes:[]})};
}`
        }
        if (id === '\0search-review-events') {
          return `export * from '/apps/web-app/shared/search.ts';
export function sendSearchEvents(events) {window.review.events.push(...events)};`
        }
        if (!id.startsWith('\0search-review-page-')) {
          return
        }
        const path = id.endsWith('before') ? `/@fs/${before}` : '/apps/web-app/app/pages/poisk.vue'
        return `import { createApp, h, Suspense } from 'vue';
import Page from '${path}';
import '/apps/web-app/app/assets/css/tokens.css';
import '/apps/web-app/app/assets/css/base.css';
import '/apps/web-app/app/assets/css/styles.css';
createApp({render:() => h('main',{style:'max-width:1120px;margin:0 auto;padding:20px 16px'},[
  h('p',{style:'color:var(--muted)'},'Изолированная проверка поиска: сбой API'),
  h(Suspense,null,{default:()=>h(Page)})
])}).mount('#app');`
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (!['/before', '/after'].includes(req.url)) {
            return next()
          }
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.end(`<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fonts}</style></head><body><div id="app"></div><script type="module" src="/@id/__x00__search-review-page-${req.url.slice(1)}"></script></body></html>`)
        })
      },
    }, nuxtSfcTestPlugin(), vue()],
    server: { host: '127.0.0.1', port: 4185, strictPort: true, fs: { allow: [root, scratch] } },
  })
  let browser
  try {
    await server.listen()
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote'] })
    for (const version of ['before', 'after']) {
      for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(`http://127.0.0.1:4185/${version}`)
        await page.getByRole('heading', { name: 'Поиск по сайту' }).waitFor()
        await page.evaluate(() => document.fonts.ready)
        if (version === 'before') {
          await page.getByText('По запросу «Форт» ничего не нашлось', { exact: true }).waitFor()
          await page.waitForFunction(() => window.review.events.length === 1)
          assert.equal(await page.evaluate(() => window.review.events[0].count), 0)
          assert.equal(await page.getByRole('alert').count(), 0)
        } else {
          await page.getByRole('alert').waitFor()
          assert.equal(await page.evaluate(() => window.review.events.length), 0)
        }
        await page.screenshot({ path: resolve(output, `${version}-failure-${width}.png`), fullPage: true })
        if (version === 'after') {
          await page.getByRole('button', { name: 'Повторить', exact: true }).click()
          await page.getByRole('status').waitFor()
          assert.equal(await page.evaluate(() => window.review.events.length), 0)
          await page.screenshot({ path: resolve(output, `after-pending-${width}.png`), fullPage: true })
          await page.evaluate(() => window.review.finish())
          await page.getByRole('link', { name: /Фикстура: форт/ }).waitFor()
          assert.equal(await page.evaluate(() => window.review.retryCalls), 1)
          assert.equal(await page.evaluate(() => window.review.events.length), 1)
          assert.equal(await page.evaluate(() => window.review.events[0].count), 1)
          await page.screenshot({ path: resolve(output, `after-retry-${width}.png`), fullPage: true })
          await page.evaluate(() => window.review.setState('empty'))
          await page.getByText('По запросу «Форт» ничего не нашлось', { exact: true }).waitFor()
          assert.equal(await page.evaluate(() => window.review.events.at(-1).count), 0)
          await page.screenshot({ path: resolve(output, `after-empty-${width}.png`), fullPage: true })
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        assert.deepEqual(errors, [], `${version} ${width}`)
        await page.close()
      }
    }
    process.stdout.write('Search failure, retry, pending and empty flows passed at 390px and 1440px; 10 screenshots.\n')
  } finally {
    await browser?.close()
    await server.close()
    await rm(scratch, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
