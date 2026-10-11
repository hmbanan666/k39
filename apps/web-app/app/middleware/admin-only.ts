import { adminRedirect } from '~~/shared/auth'

export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  const target = adminRedirect(loggedIn.value ? user.value : null)
  if (target) {
    return navigateTo(target)
  }
})
