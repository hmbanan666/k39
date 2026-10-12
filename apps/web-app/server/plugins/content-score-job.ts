import { isDatabaseReady } from '@k39/database'
import { refreshContentScores } from '../utils/scoring/run'

export default defineNitroPlugin(() => {
  const run = () => {
    if (!isDatabaseReady()) {
      return
    }
    refreshContentScores().catch((error: unknown) => {
      console.error('content scores', error)
    })
  }
  const start = setTimeout(run, 45_000)
  const timer = setInterval(run, 24 * 60 * 60 * 1000)
  start.unref?.()
  timer.unref?.()
})
