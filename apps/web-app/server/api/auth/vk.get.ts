import type { UserVK } from '#auth-utils'
import { findOrCreateUserByEmail } from '../../services/auth'
import { assertOAuthProvider } from '../../utils/oauth'

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

    await setUserSession(event, {
      user: { id: userInDb.id, email: userInDb.email },
    })

    const redirectTo = getCookie(event, 'redirectTo')
    return sendRedirect(event, redirectTo || '/')
  },
  onError(event, error) {
    logger.error('OAuth error:', error)
    return sendRedirect(event, '/sign-in')
  },
})

export default defineEventHandler((event) => {
  assertOAuthProvider('vk')
  return handler(event)
})
