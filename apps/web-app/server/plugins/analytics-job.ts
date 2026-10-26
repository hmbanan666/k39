import { runAnalyticsMaintenance } from '../utils/analytics/search-job'

export default defineNitroPlugin(() => {
  const run = () => {
    runAnalyticsMaintenance()
      .then((result) => {
        if (!result.skipped) {
          console.warn('analytics search import', JSON.stringify(result))
        }
      })
      .catch((error: unknown) => {
        console.error('analytics maintenance', error)
      })
  }
  const start = setTimeout(run, 30_000)
  const timer = setInterval(run, 60 * 60 * 1000)
  start.unref?.()
  timer.unref?.()
})
