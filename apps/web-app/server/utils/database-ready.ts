// Readiness of the database plugin. Nitro starts serving before async
// plugins finish, so migrations and the initial content may still be
// running when the first request arrives. Health reports 503 until then.
let ready = false

export function markDatabaseReady() {
  ready = true
}

export function isDatabaseReady() {
  return ready
}
