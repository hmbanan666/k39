import { describe, expect, it } from 'vitest'
import { articleTextLength } from '../shared/article-length'

describe('rendered article length', () => {
  it.each([
    ['', ''],
    ['  Двор  открыт.\r\n\nВход\tсправа.  ', 'Двор открыт. Вход справа.'],
    ['[форт](/fort-11?from=map#visit)', 'форт'],
    ['[сайт](https://example.com/path?x=1&y=2)', 'сайт'],
    ['## **История**\n\n### *Двор*', 'История Двор'],
    ['По**езд**ка и *пеший* путь.', 'Поездка и пеший путь.'],
    ['- Первый\n* Второй\n\n1. Третий\n2. Четвёртый', 'Первый Второй Третий Четвёртый'],
    ['| Место | Цена |\n| --- | ---: |\n| [Форт](/fort) | **100 ₽** |', 'Место Цена Форт 100 ₽'],
    ['<b>Текст</b> & "кавычки"', '<b>Текст</b> & "кавычки"'],
    ['&amp; &lt; &#39;', '&amp; &lt; &#39;'],
    ['[не ссылка](/broken path)', '[не ссылка](/broken path)'],
    ['# Заголовок\n\n`код` и _текст_', '# Заголовок `код` и _текст_'],
    ['[Instagram](https://instagram.com/cafe)', 'Instagram'],
    ['Ёж 🦔', 'Ёж 🦔'],
  ])('counts the rendered authored text for %j', (markdown, text) => {
    expect(articleTextLength(markdown)).toBe(text.length)
  })
})
