import { safeInternalPath } from '~~/shared/cabinet'

export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    const back = safeInternalPath(to.fullPath, '/kabinet')
    return navigateTo(`/sign-in?redirectTo=${encodeURIComponent(back)}`)
  }
})
