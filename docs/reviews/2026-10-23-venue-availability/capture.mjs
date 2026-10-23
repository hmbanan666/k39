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

// Run from repository root after a web build. Only the listing is mounted;
// Nuxt routing/head and the API are isolated. Production components/CSS/fonts
// render the changed area. A town-map interaction is covered by the unit test.
async function main() {
  const root = process.cwd()
  const output = resolve(root, 'docs/reviews/2026-10-23-venue-availability')
  const baseline = '77d69af8ef85ac258d2be3eb7fdc3bd0f0e4b880'
  const pagePath = 'apps/web-app/app/pages/zavedeniya/[[...path]].vue'
  const scratch = await mkdtemp(resolve(tmpdir(), 'k39-venue-review-'))
  await writeFile(resolve(scratch, 'before.vue'), execFileSync('git', ['show', `${baseline}:${pagePath}`]))
  const builtCss = resolve(root, 'apps/web-app/.output/public/_nuxt')
  const entry = (await readdir(builtCss)).find((name) => /^entry\..*\.css$/.test(name))
  assert(entry, 'Build the web app first to provide production fonts')
  const fontFaces = ((await readFile(resolve(builtCss, entry), 'utf8')).match(/@font-face\{[^}]+\}/g) ?? []).join('\n').replaceAll('/_fonts/', `/@fs/${root}/apps/web-app/.output/public/_fonts/`)
  let before = true
  const server = await createServer({
    configFile: false,
    root,
    publicDir: resolve(root, 'apps/web-app/public'),
    resolve: { alias: [
      { find: '~~', replacement: resolve(root, 'apps/web-app') },
      { find: '~', replacement: resolve(root, 'apps/web-app/app') },
    ] },
    plugins: [{
      name: 'isolated-listing-review',
      enforce: 'pre',
      resolveId(source) {
        if (/\/fetchPublic(?:\.ts)?$/.test(source)) {
          return '\0fixture-public'
        }
        if (/\/usePublicHead(?:\.ts)?$/.test(source)) {
          return '\0fixture-head'
        }
      },
      load(id) {
        if (id.startsWith('\0listing-entry-')) {
          const component = id.endsWith('before') ? `/@fs/${scratch}/before.vue` : `/${pagePath}`
          return `import { createApp, h, Suspense } from 'vue';
import Page from '${component}';
import { $fetch } from 'ofetch';
import '/apps/web-app/app/assets/css/tokens.css';
import '/apps/web-app/app/assets/css/base.css';
import '/apps/web-app/app/assets/css/styles.css';
window.$fetch = $fetch;
createApp({ render: () => h(Suspense, null, { default: () => h(Page) }) }).component('VenuePage', { render: () => null }).mount('#app');`
        }
        if (id === '\0fixture-public') {
          return `import { venueAvailabilityFixture } from '/apps/web-app/test/fixtures/venue-availability.ts';
export async function fetchPublic() { const page = venueAvailabilityFixture(); page.regionSlug = null; return page; }`
        }
        if (id === '\0fixture-head') {
          return 'export function usePublicHead() {}'
        }
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (req.url !== '/' && req.url !== '/before' && req.url !== '/after') {
            return next()
          }
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.end(`<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${fontFaces}</style></head>
<body><div id="app"></div><script type="module" src="/@id/__x00__listing-entry-${before ? 'before' : 'after'}"></script></body></html>`)
        })
      },
    }, nuxtSfcTestPlugin(), vue()],
    server: { host: '127.0.0.1', port: 4179, strictPort: true, fs: { allow: [root, scratch] } },
  })
  let browser
  try {
    await server.listen()
    browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote'],
    })
    for (const version of ['before', 'after']) {
      before = version === 'before'
      for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        let mode = 'failure'
        let release
        await page.route('**/api/public/availability?**', async (request) => {
          if (mode === 'pending') {
            await new Promise((done) => {
              release = done
            })
          }
          if (mode === 'failure') {
            return request.fulfill({ status: 503, body: 'Service unavailable' })
          }
          await request.fulfill({ json: { items: mode === 'empty' ? [] : [{ slug: 'fixture-cafe-photo' }] } })
        })
        await page.goto(`http://127.0.0.1:4179/${version}`)
        await page.locator('.cards .card').first().waitFor()
        await page.evaluate(() => document.fonts.ready)
        const button = page.getByRole('button', { name: 'Открыто сейчас', exact: true })
        await button.click()
        if (before) {
          await page.locator('.empty').waitFor()
          assert.equal(await page.locator('.cards .card').count(), 0)
        } else {
          await page.getByRole('alert').waitFor()
          assert.equal(await page.locator('.cards .card').count(), 3)
        }
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: resolve(output, `${version}-failure-${width}.png`) })
        if (!before) {
          mode = 'pending'
          await page.getByRole('button', { name: 'Повторить', exact: true }).click()
          await page.getByRole('status').filter({ hasText: 'Проверяем' }).waitFor()
          assert.equal(await page.locator('.cards .card').count(), 3)
          assert.equal(await button.getAttribute('aria-busy'), 'true')
          await page.evaluate(() => window.scrollTo(0, 0))
          await page.screenshot({ path: resolve(output, `after-loading-${width}.png`) })
          mode = 'success'
          release()
          await page.waitForFunction(() => document.querySelectorAll('.cards .card').length === 1)
          await page.evaluate(() => window.scrollTo(0, 0))
          await page.screenshot({ path: resolve(output, `after-filtered-${width}.png`) })
          await button.click()
          assert.equal(await page.locator('.cards .card').count(), 3)
          mode = 'empty'
          await button.click()
          await page.locator('.empty').waitFor()
          assert.equal(await page.getByRole('alert').count(), 0)
          await page.evaluate(() => window.scrollTo(0, 0))
          await page.screenshot({ path: resolve(output, `after-empty-${width}.png`) })
        }
        assert.deepEqual(errors, [], `${version} ${width}: browser errors`)
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow')
        await page.close()
      }
    }
    process.stdout.write('Browser flow passed at 390px and 1440px; 10 screenshots captured.\n')
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
