import type { UserYandex } from '#auth-utils'
import { findOrCreateUserByEmail } from '../../services/auth'
import { assertOAuthProvider } from '../../utils/oauth'
import { completeConsentedSession, guardOAuthProvider } from '../../utils/oauth-consent'

const logger = useLogger('yandex')

const handler = defineOAuthYandexEventHandler({
  async onSuccess(event, { user }) {
    assertOAuthProvider('yandex')
    if (!user?.id || !user.default_email) {
      logger.error('OAuth error: missing email')
      return sendRedirect(event, '/sign-in')
    }

    const yandexUser = user as unknown as UserYandex
    const userInDb = await findOrCreateUserByEmail({
      email: yandexUser.default_email,
      name: yandexUser.display_name,
    })

    return completeConsentedSession(event, userInDb)
  },
  onError(event, error) {
    logger.error('OAuth error:', error)
    return sendRedirect(event, '/sign-in')
  },
})

export default defineEventHandler((event) => {
  assertOAuthProvider('yandex')
  const denied = guardOAuthProvider(event)
  if (denied) {
    return denied
  }
  return handler(event)
})
