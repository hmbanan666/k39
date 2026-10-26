import { describe, expect, it } from 'vitest'
import { externalLinkAttrs } from '../shared/links'
import { renderMarkdown } from '../shared/markdown'
import { metaFootnote, metaProductFromHref, metaProductsInHtml } from '../shared/meta-links'

describe('meta product links', () => {
  it('detects Meta hosts and ignores lookalikes', () => {
    expect(metaProductFromHref('https://instagram.com/cafe')).toBe('instagram')
    expect(metaProductFromHref('https://www.instagram.com/cafe/')).toBe('instagram')
    expect(metaProductFromHref('https://m.facebook.com/cafe')).toBe('facebook')
    expect(metaProductFromHref('https://FB.COM/cafe')).toBe('facebook')
    expect(metaProductFromHref('https://www.threads.net/@cafe')).toBe('threads')
    expect(metaProductFromHref('https://wa.me/79000000000')).toBe('whatsapp')
    expect(metaProductFromHref('https://chat.whatsapp.com/abc')).toBe('whatsapp')
    expect(metaProductFromHref('https://notinstagram.com/cafe')).toBeNull()
    expect(metaProductFromHref('https://instagram.com.evil.test/cafe')).toBeNull()
    expect(metaProductFromHref('https://evil.test/instagram.com')).toBeNull()
    expect(metaProductFromHref('https://vk.com/cafe')).toBeNull()
    expect(metaProductFromHref('mailto:desk@instagram.com')).toBeNull()
    expect(metaProductFromHref('/zavedeniya/cafe')).toBeNull()
  })

  it('names only the products on the page', () => {
    expect(metaFootnote(['instagram'])).toBe(
      '* Instagram принадлежит компании Meta, признанной экстремистской и запрещённой в России.',
    )
    expect(metaFootnote(['facebook', 'instagram'])).toBe(
      '* Instagram и Facebook принадлежат компании Meta, признанной экстремистской и запрещённой в России.',
    )
    expect(metaFootnote(['threads', 'whatsapp', 'instagram'])).toBe(
      '* Instagram, Threads и WhatsApp принадлежат компании Meta, признанной экстремистской и запрещённой в России.',
    )
    expect(metaFootnote([])).toBe('')
  })

  it('marks a markdown link and leaves other links alone', () => {
    const html = renderMarkdown('[Instagram](https://instagram.com/cafe) и [сайт](https://cafe.example)')
    expect(html).toContain('href="https://instagram.com/cafe" target="_blank" rel="nofollow noopener"')
    expect(html).toContain('Instagram<sup class="meta-mark">*</sup>')
    expect(html).toContain('href="https://cafe.example" target="_blank" rel="noopener nofollow"')
    expect(html).not.toContain('cafe.example" target="_blank" rel="noopener nofollow">сайт<sup')
    expect(externalLinkAttrs('https://instagram.com/cafe')).toEqual({ target: '_blank', rel: 'nofollow noopener' })
    expect(metaProductsInHtml(html)).toEqual(['instagram'])
  })
})
