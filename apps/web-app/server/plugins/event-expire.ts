import { isDatabaseReady } from '@k39/database'
import { expireEvents } from '../utils/practical/events'

export default defineNitroPlugin(() => {
  const run = () => {
    if (!isDatabaseReady()) {
      return
    }
    expireEvents().catch((error: unknown) => {
      console.error('event expire', error)
    })
  }
  const start = setTimeout(run, 120_000)
  const timer = setInterval(run, 24 * 60 * 60 * 1000)
  start.unref?.()
  timer.unref?.()
})
