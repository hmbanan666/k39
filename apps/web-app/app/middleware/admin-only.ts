export default defineNuxtRouteMiddleware(() => {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo('/sign-in?redirectTo=/admin')
  }
  if (user.value?.role !== 'admin' && user.value?.role !== 'editor') {
    return navigateTo('/')
  }
})
