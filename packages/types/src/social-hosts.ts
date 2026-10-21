/**
 * Social-network hosts. `classifyMenuUrl`, `classifySourceUrl`, and
 * `isSocialWebsite` all call `isSocialHost`, so a host cannot be a menu
 * in one place and a social network in another.
 * `www` is ignored. A subdomain counts (`m.vk.ru`).
 */
const SOCIAL_HOSTS = [
  'vk.com',
  'vk.ru',
  't.me',
  'telegram.me',
  'telegram.org',
  'ok.ru',
  'instagram.com',
  'facebook.com',
  'fb.com',
  'fb.me',
  'threads.net',
  'youtube.com',
  'youtu.be',
  'dzen.ru',
  'tiktok.com',
  'whatsapp.com',
  'wa.me',
  'x.com',
  'twitter.com',
] as const

export function isSocialHost(host: string) {
  const bare = host.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
  if (!bare) {
    return false
  }
  return SOCIAL_HOSTS.some((name) => bare === name || bare.endsWith(`.${name}`))
}
