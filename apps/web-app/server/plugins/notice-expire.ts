import { isDatabaseReady } from '@k39/database'
import { flagExpiredNotices } from '../utils/notices/expire'

export default defineNitroPlugin(() => {
  const run = () => {
    if (!isDatabaseReady()) {
      return
    }
    flagExpiredNotices().catch((error: unknown) => {
      console.error('notice expire', error)
    })
  }
  const start = setTimeout(run, 150_000)
  const timer = setInterval(run, 60 * 60 * 1000)
  start.unref?.()
  timer.unref?.()
})
