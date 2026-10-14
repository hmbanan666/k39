// Legacy page from the old site, unrelated to the guide. 410 tells search engines it is gone for good.
export default defineEventHandler(() => {
  throw createError({ statusCode: 410, statusMessage: 'Gone' })
})
