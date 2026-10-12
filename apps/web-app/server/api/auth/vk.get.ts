import type { UserVK } from '#auth-utils'
import { findOrCreateUserByEmail } from '../../services/auth'
import { assertOAuthProvider } from '../../utils/oauth'
import { completeConsentedSession, guardOAuthProvider } from '../../utils/oauth-consent'

const logger = useLogger('vk')

const handler = defineOAuthVKEventHandler({
  config: { emailRequired: true },
  async onSuccess(event, { user }) {
    assertOAuthProvider('vk')
    if (!user?.user?.user_id || !user.user.email) {
      logger.error('OAuth error: missing email')
      return sendRedirect(event, '/sign-in')
    }

    const vkUser = (user as unknown as UserVK).user
    const userInDb = await findOrCreateUserByEmail({
      email: vkUser.email,
      name: `${vkUser.first_name} ${vkUser.last_name}`.trim(),
    })

    return completeConsentedSession(event, userInDb)
  },
  onError(event, error) {
    logger.error('OAuth error:', error)
    return sendRedirect(event, '/sign-in')
  },
})

export default defineEventHandler((event) => {
  assertOAuthProvider('vk')
  const denied = guardOAuthProvider(event)
  if (denied) {
    return denied
  }
  return handler(event)
})
