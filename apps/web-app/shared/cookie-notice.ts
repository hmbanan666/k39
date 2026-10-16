/** The cookie card stays off editor screens, where it covers the action buttons. */
export function showCookieNotice(path: string) {
  return path !== '/admin' && !path.startsWith('/admin/')
}
