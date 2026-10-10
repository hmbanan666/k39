import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export function resolveMigrationsFolder(): string {
  const besidePackage = fileURLToPath(new URL('../migrations', import.meta.url))
  const candidates = [
    process.env.MIGRATIONS_FOLDER,
    besidePackage,
    join(process.cwd(), 'migrations'),
    join(process.cwd(), 'packages/database/migrations'),
    join(process.cwd(), '../../packages/database/migrations'),
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'meta', '_journal.json'))) {
      return candidate
    }
  }

  throw new Error(`Drizzle migrations folder not found. Set MIGRATIONS_FOLDER. Tried: ${candidates.join(', ')}`)
}
