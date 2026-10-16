const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export class TestDatabaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TestDatabaseError'
  }
}

export function databaseName(connectionString: string) {
  const url = new URL(connectionString)
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!name) {
    throw new TestDatabaseError('The connection string has no database name')
  }
  return name
}

export function isLocalDatabase(connectionString: string) {
  const url = new URL(connectionString)
  return LOCAL_HOSTS.has(url.hostname)
}

export function isTestDatabaseName(name: string) {
  return /^[A-Za-z_]\w*_test$/.test(name)
}

export function withDatabaseName(connectionString: string, name: string) {
  if (!isTestDatabaseName(name)) {
    throw new TestDatabaseError(`Refusing database name ${name}. A test database must end with _test.`)
  }
  const url = new URL(connectionString)
  url.pathname = `/${name}`
  return url.toString()
}

/**
 * The suite never opens a shared database. `DATABASE_URL_TEST` wins.
 * A local `DATABASE_URL` whose name does not end with `_test` is rewritten
 * to the sibling `<name>_test` database. Anything else is refused.
 * No URL means the caller should start an ephemeral Postgres.
 */
export function resolveTestDatabaseUrl(env: NodeJS.ProcessEnv): string | null {
  const explicit = env.DATABASE_URL_TEST
  if (explicit) {
    assertResettable(explicit, 'DATABASE_URL_TEST')
    return explicit
  }
  const shared = env.DATABASE_URL
  if (!shared) {
    return null
  }
  if (!isLocalDatabase(shared)) {
    throw new TestDatabaseError('Refusing to reset a non-local DATABASE_URL for tests')
  }
  const name = databaseName(shared)
  if (isTestDatabaseName(name)) {
    return shared
  }
  return withDatabaseName(shared, `${name}_test`)
}

export function assertResettable(connectionString: string, label = 'database') {
  if (!isLocalDatabase(connectionString)) {
    throw new TestDatabaseError(`Refusing to reset a non-local ${label}`)
  }
  const name = databaseName(connectionString)
  if (!isTestDatabaseName(name)) {
    throw new TestDatabaseError(`Refusing to reset ${name}. ${label} must end with _test.`)
  }
  return name
}

export function maintenanceUrls(connectionString: string) {
  return ['postgres', 'template1'].map((name) => {
    const url = new URL(connectionString)
    url.pathname = `/${name}`
    return url.toString()
  })
}
