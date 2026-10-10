import catalog from '../../../shared/data/catalog.json'

export default defineEventHandler(() => {
  return [
    { loc: '/' },
    { loc: '/map/kaliningrad' },
    { loc: '/quest/five-forts' },
    { loc: '/legal/privacy-policy' },
    ...catalog.places.map((place) => ({ loc: `/place/${place.slug}` })),
  ]
})
