import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

if (process.env.NODE_ENV === 'production') {
  console.error('Refused: NODE_ENV=production. The dev editor session does not exist in a production process.')
  process.exit(1)
}

if (process.env.DEV_EDITOR_SESSION !== '1') {
  console.error('Refused: set DEV_EDITOR_SESSION=1 on the dev server, then run this again.')
  console.error('Browser: http://127.0.0.1:3000/api/dev/editor-session?token=<from the local token file>')
  process.exit(1)
}

const tokenPath = join(tmpdir(), `k39-dev-editor-token-${process.getuid?.() ?? 'user'}`)
let token = ''
try {
  token = readFileSync(tokenPath, 'utf8').trim()
} catch {
  token = ''
}
if (!token) {
  console.error(`No dev editor token at ${tokenPath}.`)
  console.error('Start the server with DEV_EDITOR_SESSION=1 pnpm --filter @k39/web-app dev')
  process.exit(1)
}

const url = `http://127.0.0.1:3000/api/dev/editor-session?token=${token}`
let response
try {
  response = await fetch(url, { redirect: 'manual' })
} catch {
  console.error(`Dev server is not answering at ${url}.`)
  console.error('Start it with DEV_EDITOR_SESSION=1 pnpm --filter @k39/web-app dev')
  process.exit(1)
}

if (response.status === 404) {
  console.error('Refused: the server returned 404.')
  console.error('Restart `pnpm dev` with DEV_EDITOR_SESSION=1 and NODE_ENV other than production.')
  process.exit(1)
}

if (response.status !== 302 && response.status !== 303) {
  console.error(`Unexpected status ${response.status}`)
  process.exit(1)
}

console.log('Editor session ready. Open this URL in the browser:')
console.log(url)
const cookies = typeof response.headers.getSetCookie === 'function'
  ? response.headers.getSetCookie()
  : []
for (const line of cookies) {
  console.log(line.split(';')[0])
}
