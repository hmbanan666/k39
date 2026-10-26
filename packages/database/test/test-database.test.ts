import { describe, expect, it } from 'vitest'
import { assertResettable, isTestDatabaseName, resolveTestDatabaseUrl, TestDatabaseError } from './test-database'

describe('test database url', () => {
  it('leaves the shared database alone and uses a _test sibling', () => {
    const url = resolveTestDatabaseUrl({
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/k39',
    })
    expect(url).toBe('postgres://postgres:postgres@127.0.0.1:5432/k39_test')
    expect(isTestDatabaseName('k39')).toBe(false)
    expect(isTestDatabaseName('k39_test')).toBe(true)
  })

  it('prefers DATABASE_URL_TEST when that name ends with _test', () => {
    const url = resolveTestDatabaseUrl({
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/k39',
      DATABASE_URL_TEST: 'postgres://postgres:postgres@localhost:5432/k39_suite_test',
    })
    expect(url).toContain('/k39_suite_test')
  })

  it('refuses a shared or remote database', () => {
    expect(() =>
      resolveTestDatabaseUrl({
        DATABASE_URL: 'postgres://postgres:postgres@db.example.com:5432/k39',
      }),
    ).toThrow(TestDatabaseError)
    expect(() =>
      resolveTestDatabaseUrl({
        DATABASE_URL_TEST: 'postgres://postgres:postgres@localhost:5432/k39',
      }),
    ).toThrow(/_test/)
    expect(() => assertResettable('postgres://postgres:postgres@127.0.0.1:5432/k39')).toThrow(/k39/)
  })

  it('uses testcontainers when no url is set', () => {
    expect(resolveTestDatabaseUrl({})).toBeNull()
  })
})
