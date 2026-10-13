import { basemapConfigFromRuntime, resolveBasemapUrl } from '../../utils/basemap-archive'

export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')
  const pmtilesUrl = await resolveBasemapUrl(basemapConfigFromRuntime())
  return { pmtilesUrl }
})
