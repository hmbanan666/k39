# ADR 0003: Apply Drizzle migrations on startup

## Status

Accepted

## Context

Dokploy builds `docker/web-app/Dockerfile`, runs the container, and auto-deploys `main`. There is no release step that can run `drizzle-kit migrate` before traffic. The production database is new, so a single baseline migration is enough.

## Decision

The Nitro plugin `server/plugins/01.database.ts` connects with `DATABASE_URL`, runs `drizzle-orm`'s migrator, then upserts the catalog. In the image, `MIGRATIONS_FOLDER=/app/migrations`. In local dev the folder is resolved next to the database package. Drizzle records applied migrations in `__drizzle_migrations`, so a second boot is a no-op aside from the catalog upsert.

If `DATABASE_URL` is missing, production throws and the process does not serve. Development logs a warning and still serves content pages.

## Consequences

A bad migration prevents the new container from becoming healthy, which is what we want. A long migration blocks startup. The health check timeout allows 60 seconds. Schema changes ship in the same image as the code that expects them.
