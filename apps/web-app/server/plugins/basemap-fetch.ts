import { basemapConfigFromRuntime, ensureBasemapArchive } from '../utils/basemap-archive'

// Does not block boot. A missing archive leaves the map on OpenFreeMap.
export default defineNitroPlugin(() => {
  const logger = useLogger('basemap')
  const config = basemapConfigFromRuntime()
  void ensureBasemapArchive(config, {
    log(level, message) {
      if (level === 'error') {
        logger.error(message)
        return
      }
      logger.info(message)
    },
  }).catch((error: unknown) => {
    logger.error(error)
  })
})
