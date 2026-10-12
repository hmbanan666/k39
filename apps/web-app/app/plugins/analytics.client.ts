export default defineNuxtPlugin(() => {
  const router = useRouter()
  let first = true
  router.afterEach((to, from) => {
    if (first) {
      first = false
      return
    }
    window.dispatchEvent(new CustomEvent('k39-track', {
      detail: { type: 'pageview', path: to.fullPath, ref: `${location.origin}${from.fullPath}` },
    }))
  })
})
