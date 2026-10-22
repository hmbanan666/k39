/**
 * VK community identity for the official-menu rule (ADR 0047).
 * A social link names a community by screen name (`vk.com/cafe`) or by
 * numeric id (`club10`, `public10`, `event10`). Albums, photos, posts, and
 * market items carry the owner id (`album-10_4`, `wall-10_3`, `?z=photo-10_1`).
 * Nothing here calls VK: a screen name and its id are linked only by
 * `venues.vk_community_id`, which an editor declares.
 */

/** Postgres bigint and a safe JS integer. VK ids are far below this. */
export const VK_COMMUNITY_ID_MAX = Number.MAX_SAFE_INTEGER

interface VkKeys {
  names: Set<string>
  communities: Set<string>
  users: Set<string>
}

function emptyVkKeys(): VkKeys {
  return { names: new Set(), communities: new Set(), users: new Set() }
}

/** VK section paths. They are not a community screen name. */
const VK_SYSTEM_PATH = new Set([
  'about',
  'ads',
  'album',
  'albums',
  'app',
  'apps',
  'audio',
  'audios',
  'away.php',
  'board',
  'bookmarks',
  'calls',
  'camera',
  'clips',
  'club',
  'dev',
  'doc',
  'docs',
  'event',
  'events',
  'faq',
  'fav',
  'fave',
  'feed',
  'friends',
  'games',
  'groups',
  'help',
  'id',
  'im',
  'invite',
  'join',
  'login',
  'mail',
  'market',
  'notifications',
  'pages',
  'photo',
  'photos',
  'public',
  'restore',
  'search',
  'settings',
  'stats',
  'stories',
  'support',
  'topic',
  'topics',
  'video',
  'videos',
  'wall',
  'write',
])

function absorbVkToken(keys: VkKeys, token: string) {
  const text = token.trim().replace(/^@/, '')
  if (!text) {
    return
  }
  const community = /^(?:club|public|event)(\d+)$/i.exec(text)
  if (community?.[1]) {
    keys.communities.add(community[1])
    return
  }
  const user = /^id(\d+)$/i.exec(text)
  if (user?.[1]) {
    keys.users.add(user[1])
    return
  }
  const wall = /^wall(-)?(\d+)(?:_\d+)?$/i.exec(text)
  if (wall?.[2]) {
    if (wall[1]) {
      keys.communities.add(wall[2])
    } else {
      keys.users.add(wall[2])
    }
    return
  }
  const market = /^market-(\d+)(?:_\d+)?$/i.exec(text)
  if (market?.[1]) {
    keys.communities.add(market[1])
    return
  }
  const album = /^album-(\d+)(?:_\d+)?$/i.exec(text)
  if (album?.[1]) {
    keys.communities.add(album[1])
    return
  }
  const attachment = /^(?:photo|doc|topic|video)-(\d+)_\d+/i.exec(text)
  if (attachment?.[1]) {
    keys.communities.add(attachment[1])
    return
  }
  if (/\.php$/i.test(text) || VK_SYSTEM_PATH.has(text.toLowerCase())) {
    return
  }
  if (/^[a-z][\w.-]{0,63}$/i.test(text)) {
    keys.names.add(text.toLowerCase())
  }
}

/** Parts of `w` or `z` that name an object. Those owners replace the path. */
function vkObjectTokens(parsed: URL) {
  const tokens: string[] = []
  for (const name of ['w', 'z']) {
    const raw = parsed.searchParams.get(name)
    if (!raw) {
      continue
    }
    for (const part of raw.split('/')) {
      const probe = emptyVkKeys()
      absorbVkToken(probe, part)
      if (probe.communities.size || probe.users.size) {
        tokens.push(part)
      }
    }
  }
  return tokens
}

function vkUrl(url: string | null | undefined) {
  const text = url?.trim() ?? ''
  if (!text) {
    return null
  }
  let parsed: URL
  try {
    parsed = new URL(text)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
  if (host !== 'vk.com' && !host.endsWith('.vk.com') && host !== 'vk.ru' && !host.endsWith('.vk.ru')) {
    return null
  }
  return parsed
}

function vkKeys(url: string | null | undefined): VkKeys | null {
  const parsed = vkUrl(url)
  if (!parsed) {
    return null
  }
  const keys = emptyVkKeys()
  const objects = vkObjectTokens(parsed)
  if (objects.length) {
    for (const token of objects) {
      absorbVkToken(keys, token)
    }
  } else {
    absorbVkToken(keys, parsed.pathname.split('/').filter(Boolean)[0] ?? '')
  }
  if (!keys.names.size && !keys.communities.size && !keys.users.size) {
    return null
  }
  return keys
}

function vkKeysOverlap(left: VkKeys, right: VkKeys) {
  for (const name of left.names) {
    if (right.names.has(name)) {
      return true
    }
  }
  for (const id of left.communities) {
    if (right.communities.has(id)) {
      return true
    }
  }
  for (const id of left.users) {
    if (right.users.has(id)) {
      return true
    }
  }
  return false
}

/**
 * Positive integer, or null for an empty value. A number, or a string of
 * digits, is accepted. Anything else (`club10`, `-10`, `1.5`, `abc`) is
 * `invalid`, so a form can name the field instead of guessing.
 */
export function parseVkCommunityId(value: unknown): number | null | 'invalid' {
  if (value == null) {
    return null
  }
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) {
      return null
    }
    if (!/^\d+$/.test(text)) {
      return 'invalid'
    }
    return parseVkCommunityId(Number(text))
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > VK_COMMUNITY_ID_MAX) {
    return 'invalid'
  }
  return value
}

/**
 * The VK links among `socials`. `names` are screen names, `communityIds`
 * are numeric community ids that the links already carry
 * (`club`, `public`, `event`, `wall-`, `market-`, `album-`, an attachment, or a `w=`/`z=` owner).
 */
export function vkSocialLinks(socials: ReadonlyArray<{ url: string }>) {
  const names = new Set<string>()
  const communityIds = new Set<number>()
  let links = 0
  for (const row of socials) {
    const keys = vkKeys(row.url)
    if (!keys) {
      continue
    }
    links += 1
    for (const name of keys.names) {
      names.add(name)
    }
    for (const id of keys.communities) {
      communityIds.add(Number(id))
    }
  }
  return { links, names: [...names], communityIds: [...communityIds] }
}

/**
 * Why a declared community id cannot be stored with these socials, or null.
 * The id belongs to a VK link in socials. When every VK link already names
 * a numeric community, the id has to be one of them: a different number is
 * a typo, not a second community.
 */
export function vkCommunityIdProblem(id: number | null, socials: ReadonlyArray<{ url: string }>): 'no_vk_link' | 'mismatch' | null {
  if (id == null) {
    return null
  }
  const vk = vkSocialLinks(socials)
  if (!vk.links) {
    return 'no_vk_link'
  }
  if (!vk.names.length && !vk.communityIds.includes(id)) {
    return 'mismatch'
  }
  return null
}

/**
 * True when the price URL and the venue's VK community are the same.
 * The community is every VK link in `socials`, plus `communityId` when at
 * least one VK link is stored: the numeric id of that screen-name link.
 */
export function vkMenuMatchesSocial(
  priceUrl: string | null | undefined,
  socials: ReadonlyArray<{ url: string }>,
  communityId?: number | null,
) {
  const price = vkKeys(priceUrl)
  if (!price) {
    return false
  }
  let linked = false
  for (const row of socials) {
    const social = vkKeys(row.url)
    if (!social) {
      continue
    }
    linked = true
    if (vkKeysOverlap(price, social)) {
      return true
    }
  }
  return linked && communityId != null && price.communities.has(String(communityId))
}
