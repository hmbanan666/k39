export async function fetchPublic<T>(url: string, query?: Record<string, string | number>) {
  try {
    return await $fetch<T>(url, query ? { query } : undefined)
  } catch (error: unknown) {
    const statusCode = typeof error === 'object' && error && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode)
      : 500
    throw createError({
      statusCode: statusCode || 500,
      statusMessage: statusCode === 404 ? 'Страница не найдена' : 'Ошибка загрузки',
      fatal: true,
    })
  }
}
