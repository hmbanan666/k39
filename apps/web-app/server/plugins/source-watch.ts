import { isDatabaseReady } from '@k39/database'
import { watchSources } from '../utils/facts/watch'

export default defineNitroPlugin(() => {
  const run = () => {
    if (!isDatabaseReady()) {
      return
    }
    watchSources().catch((error: unknown) => {
      console.error('source watch', error)
    })
  }
  const start = setTimeout(run, 90_000)
  const timer = setInterval(run, 24 * 60 * 60 * 1000)
  start.unref?.()
  timer.unref?.()
})
