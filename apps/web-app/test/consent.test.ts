import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONSENT_VERSION, consentDeniedLocation, consentParamAccepted, isOAuthCallback, oauthCallbackAllowed, oauthStartAllowed } from '../shared/consent'
import { LEGAL_LINKS } from '../shared/links'
import { operatorIdLine } from '../shared/operator'

describe('oauth consent gate', () => {
  it('requires the consent param and the current document version', () => {
    expect(consentParamAccepted('1', CONSENT_VERSION)).toBe(true)
    expect(consentParamAccepted(undefined, CONSENT_VERSION)).toBe(false)
    expect(consentParamAccepted('1', '2020-01-01')).toBe(false)
    expect(consentParamAccepted('true', CONSENT_VERSION)).toBe(false)
    expect(consentParamAccepted(['1'], CONSENT_VERSION)).toBe(false)
  })

  it('accepts a consented start and rejects a callback without that proof', () => {
    expect(oauthStartAllowed({ consent: '1', version: CONSENT_VERSION, cookie: undefined })).toBe(true)
    expect(oauthStartAllowed({ consent: undefined, version: undefined, cookie: CONSENT_VERSION })).toBe(true)
    expect(oauthStartAllowed({ consent: undefined, version: undefined, cookie: undefined })).toBe(false)
    expect(oauthStartAllowed({ consent: undefined, version: undefined, cookie: 'stale' })).toBe(false)
    expect(oauthCallbackAllowed(CONSENT_VERSION)).toBe(true)
    expect(oauthCallbackAllowed(undefined)).toBe(false)
    expect(oauthCallbackAllowed('stale')).toBe(false)
    expect(isOAuthCallback({ code: 'abc' })).toBe(true)
    expect(isOAuthCallback({ error: 'access_denied' })).toBe(true)
    expect(isOAuthCallback({ provider: 'yandex' })).toBe(false)
  })

  it('sends a missing consent back to sign-in and keeps an internal return path', () => {
    expect(consentDeniedLocation(undefined)).toBe('/sign-in?error=consent')
    expect(consentDeniedLocation('/admin')).toBe('/sign-in?error=consent&redirectTo=%2Fadmin')
    expect(consentDeniedLocation('https://evil.example')).toBe('/sign-in?error=consent')
    expect(consentDeniedLocation('//evil.example')).toBe('/sign-in?error=consent')
  })
})

describe('consent document placement', () => {
  const root = resolve(process.cwd(), 'apps/web-app')
  const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

  it('prints the OGRNIP beside the INN and links the consent only from sign-in and the policy', () => {
    expect(operatorIdLine()).toBe('ИНН 110111889708, ОГРНИП 319112100033557')
    expect(LEGAL_LINKS.map((link) => link.href)).not.toContain('/soglasie')

    const privacy = read('app/pages/privacy.vue')
    const terms = read('app/pages/terms.vue')
    const consent = read('app/pages/soglasie.vue')
    const signIn = read('app/pages/sign-in.vue')
    const about = read('app/pages/about.vue')
    const footer = read('app/components/SiteFooter.vue')

    for (const page of [privacy, terms, consent, read('app/components/OperatorContacts.vue')]) {
      expect(page).toContain('operatorIdLine()')
      expect(page).not.toContain('319112100033557')
    }
    expect(about).not.toContain('operatorIdLine')
    expect(about).not.toContain('319112100033557')
    expect(footer).not.toContain('/soglasie')
    expect(footer).not.toContain('319112100033557')

    expect(consent).toContain('Согласие на обработку персональных данных')
    expect(consent).toContain('свободно, своей волей и в своём интересе')
    expect(consent).toContain('изображение профиля')
    expect(consent).toContain('идентификатор учётной записи')
    expect(consent).toContain('регистрация и авторизация на Сайте')
    expect(consent).toContain('работа личного кабинета')
    expect(consent).toContain('связь с пользователем')
    expect(consent).toContain('сбор, запись, систематизация, накопление, хранение, уточнение, извлечение, использование, удаление, уничтожение')
    expect(consent).toContain('Трансграничная передача данных не осуществляется')
    expect(consent).toContain('href="/privacy"')
    expect(privacy).toContain('href="/soglasie"')
    expect(privacy).toContain('Данные учётной записи мы обрабатываем на основании вашего отдельного согласия')
    expect(terms).not.toContain('/soglasie')

    expect(signIn).toContain('Нажимая кнопку входа, вы даёте')
    expect(signIn).toContain('href="/soglasie"')
    expect(signIn).toContain('Согласие на обработку персональных данных')
    expect(signIn).toContain('href="/privacy"')
    expect(signIn).toMatch(/Политику конфиденциальности\s*<\/UiLink>\./)
    expect(signIn).not.toMatch(/<\/UiLink>\s+\./)
    expect(signIn).toContain('consent: \'1\'')
    expect(signIn).toContain('version: CONSENT_VERSION')
    expect(signIn).not.toContain('type="checkbox"')
    expect(signIn).not.toContain('agreed')
    expect(signIn).not.toContain('Кнопка входа означает согласие')
  })
})
