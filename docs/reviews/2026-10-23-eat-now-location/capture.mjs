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
  const output = resolve(root, 'docs/reviews/2026-10-23-eat-now-location')
  const scratch = await mkdtemp(resolve(tmpdir(), 'k39-location-review-'))
  const baseline = '29742df4a3b048c6abb47cebe9c73eccd87dca16'
  await writeFile(resolve(scratch, 'before.vue'), execFileSync('git', ['show', `${baseline}:apps/web-app/app/components/EatNowPage.vue`]))
  const builtCss = resolve(root, 'apps/web-app/.output/public/_nuxt')
  const entry = (await readdir(builtCss)).find((name) => /^entry\..*\.css$/.test(name))
  assert(entry, 'Build the web app first for production fonts')
  const fonts = ((await readFile(resolve(builtCss, entry), 'utf8')).match(/@font-face\{[^}]+\}/g) || []).join('\n').replaceAll('/_fonts/', `/@fs/${root}/apps/web-app/.output/public/_fonts/`)
  const server = await createServer({
    configFile: false,
    root,
    publicDir: resolve(root, 'apps/web-app/public'),
    resolve: { alias: [
      { find: '~~', replacement: resolve(root, 'apps/web-app') },
      { find: '~', replacement: resolve(root, 'apps/web-app/app') },
    ] },
    plugins: [{
      name: 'location-review',
      enforce: 'pre',
      resolveId(id) {
        if (/\/usePublicHead(?:\.ts)?$/.test(id)) {
          return '\0review-head'
        }
      },
      load(id) {
        if (id === '\0review-head') {
          return 'export function usePublicHead() {}'
        }
        if (id.startsWith('\0location-review-')) {
          const component = id.endsWith('before') ? `/@fs/${scratch}/before.vue` : '/apps/web-app/app/components/EatNowPage.vue'
          return `import { createApp, h } from 'vue';
import Page from '${component}';
import { eatNowLocationFixture } from '/apps/web-app/test/fixtures/eat-now-location.ts';
import '/apps/web-app/app/assets/css/tokens.css';
import '/apps/web-app/app/assets/css/base.css';
import '/apps/web-app/app/assets/css/styles.css';
createApp({ render: () => h(Page, { page: eatNowLocationFixture() }) }).mount('#app');`
        }
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (!['/before', '/after'].includes(req.url)) {
            return next()
          }
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.end(`<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${fonts}</style></head><body><div id="app"></div><script type="module" src="/@id/__x00__location-review-${req.url.slice(1)}"></script></body></html>`)
        })
      },
    }, nuxtSfcTestPlugin(), vue()],
    server: { host: '127.0.0.1', port: 4181, strictPort: true, fs: { allow: [root, scratch] } },
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
        // Deterministic permission/position callbacks; no real location is read.
        await page.addInitScript(() => {
          window.reviewGeo = { code: 1, calls: 0, done: false }
          Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
            getCurrentPosition(success, fail) {
              window.reviewGeo.calls++
              window.reviewGeo.success = success
              if (window.reviewGeo.code) {
                queueMicrotask(() => {
                  fail({ code: window.reviewGeo.code })
                  window.reviewGeo.done = true
                })
              }
            },
          } })
        })
        await page.goto(`http://127.0.0.1:4181/${version}`)
        await page.locator('.card').first().waitFor()
        await page.evaluate(() => document.fonts.ready)
        assert.equal(await page.evaluate(() => window.reviewGeo.calls), 0)
        const button = page.locator('.tools button')
        await button.click()
        await page.waitForFunction(() => window.reviewGeo.done)
        if (version === 'after') {
          await page.getByRole('alert').waitFor()
          assert.equal(await button.textContent().then((text) => text.trim()), 'Повторить')
        } else {
          assert.equal(await page.getByRole('alert').count(), 0)
        }
        assert.equal(await page.locator('.card').count(), 3)
        const centreDistances = await page.locator('.dist').allTextContents()
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.screenshot({ path: resolve(output, `${version}-denied-${width}.png`) })
        if (version === 'after') {
          await page.evaluate(() => {
            window.reviewGeo.code = 0
          })
          await button.click()
          await page.getByRole('status').filter({ hasText: 'Определяем' }).waitFor()
          assert.deepEqual(await page.locator('.dist').allTextContents(), centreDistances)
          await page.evaluate(() => window.reviewGeo.success({ coords: { latitude: 54.71, longitude: 20.51 } }))
          await page.waitForFunction(() => document.querySelector('.tools .note').textContent.includes('от вас'))
          assert((await page.locator('.name').first().textContent()).includes('кафе на площади'))
          await page.evaluate(() => window.scrollTo(0, 0))
          await page.screenshot({ path: resolve(output, `after-success-${width}.png`) })
          const previousDistances = await page.locator('.dist').allTextContents()
          await page.evaluate(() => {
            window.reviewGeo.code = 3
          })
          await button.click()
          await page.getByRole('alert').filter({ hasText: 'прежнее местоположение' }).waitFor()
          assert.deepEqual(await page.locator('.dist').allTextContents(), previousDistances)
        }
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow')
        assert.deepEqual(errors, [])
        await page.close()
      }
    }
    process.stdout.write('Location denial/retry/success/refresh failure passed at 390px and 1440px.\n')
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
