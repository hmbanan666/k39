import type { MediaLicense } from '@k39/database'
import type { H3Event } from 'h3'
import { db } from '@k39/database'
import { createError } from 'h3'
import { GUEST_CONSENT_METHOD, GUEST_CONSENT_VERSION } from '../../../shared/consent'
import { guestByline, inspectGuestText, lengthProblem } from '../../../shared/guest'
import { deleteMediaCompletely, ingestImage } from '../../media/ingest'
import { limitGuestPhoto } from '../cabinet/rate'
import { requireGuestAuthor, requireGuestConsent, resolveGuestSubject } from './submit'

export async function submitGuestPhoto(event: H3Event) {
  const parts = await readMultipartFormData(event)
  const text = (name: string) => parts?.find((part) => part.name === name)?.data?.toString() || ''
  requireGuestConsent(text('consent'))
  if (text('rights') !== '1') {
    throw createError({ statusCode: 400, statusMessage: 'Без подтверждения прав фотография не сохраняется.' })
  }
  const user = await requireGuestAuthor(event)
  const subject = await resolveGuestSubject(text('subjectType'), text('subjectSlug'))
  const member = subject.subjectType === 'venue' ? await db.venueClaims.member(subject.subjectId, user.id) : null
  if (member) {
    throw createError({ statusCode: 403, statusMessage: 'Отзыв, совет и фото своего заведения оставляют через кабинет.' })
  }
  const alt = text('alt')
  const altProblem = lengthProblem('alt', alt)
  const checked = inspectGuestText(alt)
  if (altProblem || !checked.ok) {
    throw createError({ statusCode: 400, statusMessage: altProblem || (!checked.ok ? checked.message : 'Проверьте подпись.') })
  }
  const file = parts?.find((part) => part.name === 'file' && part.data?.length)
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен файл JPEG, PNG или WebP.' })
  }
  limitGuestPhoto(user.id)
  const result = await ingestImage({
    bytes: file.data,
    mime: file.type || 'application/octet-stream',
    filename: file.filename || 'upload',
    alt: checked.body,
    author: guestByline(user.name),
    license: 'guest' as MediaLicense,
    sourceUrl: null,
    caption: null,
  })
  if ('error' in result) {
    throw createError({ statusCode: result.statusCode, statusMessage: result.error })
  }
  await db.consent.record({ userId: user.id, version: GUEST_CONSENT_VERSION, method: GUEST_CONSENT_METHOD })
  const created = await db.guests.create({
    userId: user.id,
    subjectType: subject.subjectType,
    subjectId: subject.subjectId,
    kind: 'photo',
    body: null,
    alt: checked.body,
    correctionKind: null,
    correctionValue: null,
    sourceUrl: null,
    mediaId: result.row.id,
    bodyKey: null,
  })
  if (!created.ok) {
    await deleteMediaCompletely(result.row.id)
    const message = created.reason === 'cap'
      ? 'На этой странице уже три ваших фото. Уберите одно в кабинете.'
      : 'Такое фото уже ждёт решения.'
    throw createError({ statusCode: 409, statusMessage: message })
  }
  return { id: created.id, status: 'pending' as const }
}
