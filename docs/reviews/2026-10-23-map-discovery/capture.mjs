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
  const output = resolve(root, 'docs/reviews/2026-10-23-map-discovery')
  const baseline = '5cd763c0337b7def9374e8305a615e373f72230e'
  const scratch = await mkdtemp(resolve(tmpdir(), 'k39-footer-review-'))
  const source = (path) => execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })
  await writeFile(resolve(scratch, 'links.ts'), source('apps/web-app/shared/links.ts').replace('\'./meta-links\'', '\'~~/shared/meta-links\''))
  await writeFile(resolve(scratch, 'before.vue'), source('apps/web-app/app/components/SiteFooter.vue').replace('\'~~/shared/links\'', `'${scratch}/links.ts'`))
  const builtCss = resolve(root, 'apps/web-app/.output/public/_nuxt')
  const entry = (await readdir(builtCss)).find((name) => /^entry\..*\.css$/.test(name))
  assert(entry, 'Build the web app first for production fonts')
  const fonts = ((await readFile(resolve(builtCss, entry), 'utf8')).match(/@font-face\{[^}]+\}/g) || []).join('\n').replaceAll('/_fonts/', `/@fs/${root}/apps/web-app/.output/public/_fonts/`)
  const server = await createServer({
    configFile: false,
    root,
    resolve: { alias: [
      { find: '~~', replacement: resolve(root, 'apps/web-app') },
      { find: '~', replacement: resolve(root, 'apps/web-app/app') },
    ] },
    plugins: [{
      name: 'footer-review',
      load(id) {
        if (id.startsWith('\0footer-review-')) {
          const component = id.endsWith('before') ? `/@fs/${scratch}/before.vue` : '/apps/web-app/app/components/SiteFooter.vue'
          return `import { createApp, h } from 'vue';
import Footer from '${component}';
import '/apps/web-app/app/assets/css/tokens.css';
import '/apps/web-app/app/assets/css/base.css';
import '/apps/web-app/app/assets/css/styles.css';
createApp({ render: () => h(Footer) }).mount('#app');`
        }
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (!['/before', '/after'].includes(req.url)) {
            return next()
          }
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.end(`<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${fonts}</style></head><body><div id="app"></div><script type="module" src="/@id/__x00__footer-review-${req.url.slice(1)}"></script></body></html>`)
        })
      },
    }, nuxtSfcTestPlugin(), vue()],
    server: { host: '127.0.0.1', port: 4180, strictPort: true, fs: { allow: [root, scratch] } },
  })
  let browser
  try {
    await server.listen()
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote'] })
    for (const version of ['before', 'after']) {
      for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1100 }, reducedMotion: 'reduce' })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(`http://127.0.0.1:4180/${version}`)
        const footer = page.locator('footer')
        await footer.waitFor()
        await page.evaluate(() => document.fonts.ready)
        const maps = footer.getByRole('link', { name: 'Карта', exact: true })
        assert.equal(await maps.count(), version === 'before' ? 2 : 1)
        assert.equal(await maps.first().getAttribute('href'), '/map')
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow')
        await footer.screenshot({ path: resolve(output, `${version}-${width}.png`) })
        assert.deepEqual(errors, [])
        await page.close()
      }
    }
    process.stdout.write('Footer before/after passed at 390px and 1440px.\n')
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
