import { ensureSessionPassword } from '../utils/session-secret'

export default defineNitroPlugin(() => {
  ensureSessionPassword()
})
