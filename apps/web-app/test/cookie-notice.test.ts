import { describe, expect, it } from 'vitest'
import { showCookieNotice } from '../shared/cookie-notice'

describe('cookie notice', () => {
  it('stays on public pages and stays off admin', () => {
    expect(showCookieNotice('/')).toBe(true)
    expect(showCookieNotice('/eda')).toBe(true)
    expect(showCookieNotice('/admin')).toBe(false)
    expect(showCookieNotice('/admin/places')).toBe(false)
    expect(showCookieNotice('/admin/venues/new')).toBe(false)
    expect(showCookieNotice('/administratsiya')).toBe(true)
  })
})
