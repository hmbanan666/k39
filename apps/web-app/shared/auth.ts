export function adminRedirect(user: { role?: string } | null | undefined) {
  if (!user) {
    return '/sign-in?redirectTo=/admin'
  }
  if (user.role === 'admin' || user.role === 'editor') {
    return null
  }
  return '/'
}
