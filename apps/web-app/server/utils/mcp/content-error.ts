import { createError } from 'h3'

export function rethrowContentWrite(error: unknown): never {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('Place not found')) {
    throw createError({ statusCode: 400, statusMessage: message })
  }
  if (message.startsWith('Cannot delete:')) {
    throw createError({ statusCode: 409, statusMessage: message })
  }
  throw error
}
