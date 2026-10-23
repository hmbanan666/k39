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
  const output = resolve(root, 'docs/reviews/2026-10-23-admission-extras-implementation')
  const baseline = '2a332295f9f4f918616ac89cde343fb2e3745e33'
  const scratch = await mkdtemp(resolve(tmpdir(), 'k39-admission-review-'))
  for (const [name, path] of [['before-public.vue', 'app/components/TicketsFact.vue'], ['before-admin.vue', 'app/components/admin/PracticalEditor.vue'], ['before-admission.ts', 'shared/admission.ts']]) {
    await writeFile(resolve(scratch, name), execFileSync('git', ['show', `${baseline}:apps/web-app/${path}`]))
  }
  const builtCss = resolve(root, 'apps/web-app/.output/public/_nuxt')
  const entry = (await readdir(builtCss)).find((name) => /^entry\..*\.css$/.test(name))
  assert(entry, 'Build first for production fonts')
  const fonts = ((await readFile(resolve(builtCss, entry), 'utf8')).match(/@font-face\{[^}]+\}/g) || []).join('\n').replaceAll('/_fonts/', `/@fs/${root}/apps/web-app/.output/public/_fonts/`)
  const server = await createServer({
    configFile: false, root, publicDir: resolve(root, 'apps/web-app/public'),
    resolve: { alias: [
      { find: '~~', replacement: resolve(root, 'apps/web-app') },
      { find: '~', replacement: resolve(root, 'apps/web-app/app') },
      { find: '@k39/types/freshness', replacement: resolve(root, 'packages/types/src/freshness.ts') },
    ] },
    plugins: [{
      name: 'admission-review', enforce: 'pre',
      resolveId(id, importer) {
        if (importer === resolve(scratch, 'before-admin.vue') && id.endsWith('/shared/admission')) {
          return resolve(scratch, 'before-admission.ts')
        }
      },
      load(id) {
        if (!id.startsWith('\0admission-review-')) {
          return
        }
        const version = id.endsWith('before') ? 'before' : 'after'
        const pub = version === 'before' ? `/@fs/${scratch}/before-public.vue` : '/apps/web-app/app/components/TicketsFact.vue'
        const admin = version === 'before' ? `/@fs/${scratch}/before-admin.vue` : '/apps/web-app/app/components/admin/PracticalEditor.vue'
        return `import { createApp, h, Suspense, ref } from 'vue';
import Tickets from '${pub}';
import Editor from '${admin}';
import FactsCard from '/apps/web-app/app/components/FactsCard.vue';
import { admissionView } from '/apps/web-app/shared/admission.ts';
import { admissionEntry, admissionExtra, admissionEditorFixture, admissionReviewNow } from '/apps/web-app/test/fixtures/admission-extras.ts';
import '/apps/web-app/app/assets/css/tokens.css';
import '/apps/web-app/app/assets/css/base.css';
import '/apps/web-app/app/assets/css/styles.css';
const fixture = admissionEditorFixture();
window.review = { calls: [], fail: false, state: 'fresh', setState: null };
window.$fetch = async (_url, options) => {
  if (options?.method === 'PUT') {
    window.review.calls.push(structuredClone(options.body));
    if (window.review.fail) throw Object.assign(new Error('fixture error'), { data: { statusMessage: 'Фикстура: не удалось сохранить допуслуги' } });
    if (options.body.rows !== undefined) fixture.admission = options.body.rows;
    if (options.body.extras !== undefined) fixture.admissionExtras = options.body.extras;
    fixture.shownExtraSlots = fixture.admissionExtras.map(row => row.slot);
    return { writingWarnings: [] };
  }
  return structuredClone(fixture);
};
createApp({ setup() {
  const state = ref('fresh'); window.review.setState = value => state.value = value;
  return () => h('main', { style: 'max-width:760px;margin:0 auto;padding:20px 16px;' }, [
    h('h1', 'Фикстура: билеты и допуслуги'),
    h('div', { id: 'public-block' }, [h(FactsCard, null, { default: () => h(Tickets, { admission: admissionView(state.value === 'stale' ? [admissionEntry({checkedAt:'2025-01-01'}), admissionExtra({checkedAt:'2025-01-01'})] : state.value === 'only' ? [admissionExtra({unit:null})] : [admissionEntry(), admissionExtra(), admissionExtra({slot:'tour', label:'Фикстура: экскурсия', unit:'group', condition:'Для группы до 10 человек. Нужен входной билет.',sortOrder:1})], admissionReviewNow) }) })]),
    h('div', { id: 'admin-block' }, [h(Suspense, null, {default: () => h(Editor, {subjectType:'route',subjectId:'fixture'})})])
  ]);
}}).mount('#app');`
      },
      configureServer(instance) {
        instance.middlewares.use((req, res, next) => {
          if (!['/before', '/after'].includes(req.url)) {
            return next()
          }
          res.setHeader('content-type', 'text/html; charset=utf-8')
          res.end(`<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${fonts}</style></head><body><div id="app"></div><script type="module" src="/@id/__x00__admission-review-${req.url.slice(1)}"></script></body></html>`)
        })
      },
    }, nuxtSfcTestPlugin(), vue()],
    server: { host: '127.0.0.1', port: 4184, strictPort: true, fs: { allow: [root, scratch] } },
  })
  let browser
  try {
    await server.listen()
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote'] })
    for (const version of ['before', 'after']) {
      for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
        const errors = []
        page.on('pageerror', (error) => errors.push(error.stack || error.message))
        await page.goto(`http://127.0.0.1:4184/${version}`)
        await page.getByRole('button', { name: 'Сохранить билеты', exact: true }).waitFor()
        await page.evaluate(() => document.fonts.ready)
        const pub = page.locator('#public-block')
        await pub.screenshot({ path: resolve(output, `${version}-public-${width}.png`) })
        if (version === 'before') {
          assert.equal(await pub.getByText('Дополнительно', { exact: true }).count(), 0)
        } else {
          await pub.getByText('Дополнительно', { exact: true }).waitFor()
          assert.match((await pub.textContent()) ?? '', /за устройство/)
          assert.match((await pub.textContent()) ?? '', /за группу/)
          await page.evaluate(() => window.review.setState('stale'))
          await pub.getByText('Стоимость дополнительных услуг уточняйте').waitFor()
          await pub.screenshot({ path: resolve(output, `after-stale-${width}.png`) })
          await page.evaluate(() => window.review.setState('only'))
          await pub.getByText('Стоимость билета уточняйте').waitFor()
          assert.doesNotMatch((await pub.textContent()) ?? '', /за человека/)
        }
        const admin = page.locator('#admin-block')
        await admin.screenshot({ path: resolve(output, `${version}-admin-${width}.png`) })
        if (version === 'after') {
          const field = admin.getByLabel('Название услуги', { exact: true })
          await field.fill('Фикстура: несохранённая экскурсия')
          await admin.getByRole('button', { name: 'Сохранить билеты', exact: true }).click()
          await admin.getByRole('status').filter({ hasText: 'Билеты сохранены' }).waitFor()
          assert.equal(await field.inputValue(), 'Фикстура: несохранённая экскурсия')
          assert.equal(await page.evaluate(() => Object.hasOwn(window.review.calls[0], 'extras')), false)
          await page.evaluate(() => {
            window.review.fail = true
          })
          await admin.getByRole('button', { name: 'Сохранить допуслуги', exact: true }).click()
          await admin.getByRole('status').filter({ hasText: 'не удалось сохранить' }).waitFor()
          assert.equal(await field.inputValue(), 'Фикстура: несохранённая экскурсия')
          await admin.screenshot({ path: resolve(output, `after-error-${width}.png`) })
          await page.evaluate(() => {
            window.review.fail = false
          })
          await admin.getByRole('button', { name: 'Сохранить допуслуги', exact: true }).click()
          await admin.getByRole('status').filter({ hasText: 'Допуслуги сохранены' }).waitFor()
          assert.equal(await page.evaluate(() => Object.hasOwn(window.review.calls.at(-1), 'rows')), false)
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        assert.deepEqual(errors, [], `${version} ${width}`)
        await page.close()
      }
    }
    process.stdout.write('Admission public/admin flows passed at 390px and 1440px; 12 screenshots captured.\n')
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
