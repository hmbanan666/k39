import { isDatabaseReady } from '@k39/database'
import { refreshScheduleIntervals } from '../utils/schedule'

// Slides the materialised schedule window forward once a day (ADR 0028).
export default defineNitroPlugin(() => {
  const run = () => {
    if (!isDatabaseReady()) {
      return
    }
    refreshScheduleIntervals().catch((error: unknown) => {
      console.error('schedule intervals', error)
    })
  }
  const start = setTimeout(run, 60_000)
  const timer = setInterval(run, 24 * 60 * 60 * 1000)
  start.unref?.()
  timer.unref?.()
})
