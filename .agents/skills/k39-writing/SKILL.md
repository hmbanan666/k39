---
name: k39-writing
description: Use when writing or editing Russian copy for a K39 place, venue, route, collection, quest, or hub. Covers voice, the stop-list, length, structure, and FAQ.
---

# K39 writing

Write for a visitor who will go there. Concrete facts, not adjectives. The stop-list source is `apps/web-app/shared/writing.ts`. `content_guide` prints `writingGuideSection()`. Add a banned phrase there, then keep the same `phrase` in this file. `apps/web-app/test/writing.test.ts` fails if they diverge.

Field shapes, schedule JSON, and module tags stay in `content_guide` (`apps/web-app/server/utils/mcp/guide.ts`). This skill is the voice bar.

## Voice

- Say what is there, when it was built or opened, what it costs, and how to get there, only when a source says so.
- One fact per sentence. Short sentences.
- Russian. UI chrome and the HTML title follow AGENTS.md: `{title} | K39` or `{seoTitle} | K39`. No second type word.
- Leave a field empty when you do not know. See `k39-sources-and-facts`.

## Stop-list

Search every Russian string, including the spelling without ё.

Phrases (`WRITING_STOP_LIST`):

- «уютная атмосфера»
- «идеальное место»
- «каждый найдёт»
- «каждый найдет»
- «гастрономическое путешествие»
- «в самом сердце»
- «порадует»
- «приятно удивит»
- «на любой вкус»
- «по-домашнему»
- «атмосферн» (атмосферный, атмосферно, and the rest)
- «гостеприимн»
- «отличный выбор»
- «стоит посетить»
- «не оставит равнодушн»
- «окунуться»
- «для ценителей»
- «вкусно и недорого»

Patterns (`WRITING_STOP_PATTERNS`, real regexes in `writing.ts`):

- empty superlatives: лучший, самый, уникальный, неповторимый, незабываемый, идеальный, with their hard-rule endings. A stem plus a closed list of endings keeps «самый» from matching «самовар», «самолёт», or «самостоятельно». «лучше» stays allowed. «сам», «сама», and «сами» are not «самый»
- ambiguous superlative: «самом», «самого», «самому», «самой», and «самою» always receive an explicit uncertainty advisory, whether used in «у самой Куршской косы», «у самого Балтийского моря», or genuinely promotional «самой красивой улицей». The advisory costs zero points and permits publication; it does not identify degree, proper names or acceptable style. Review the context manually before publishing. Unambiguous degree forms and independent bans, including «в самом сердце», still block publication
- настоящий as an intensifier only («настоящий борщ», «настоящая история»). Not «в настоящее время», «настоящий адрес», «настоящее имя»
- triads of evaluative adjectives («вкусно, душевно и атмосферно»). A neutral list («хлеб, молоко и сыр») is allowed
- «не просто X, а Y»
- an em dash (U+2014, the character —) in body copy, UI chrome, or the HTML title. Use a period, a comma, a colon, or parentheses.

Venue prose (`VENUE_COPY_RULES`): do not retell the price list (price retelling) and do not carry a disclaimer about price anchors or packaged juice (price disclaimer). Prices stay in «Ориентиры цен» and «Что заказать». The grid already prints «Цены могли измениться».

Never name `kgdmore.ru` (`WRITING_BANNED_SITES`). Do not link it and do not use it as a source.

Never paste another site's sentences, and do not keep their sentence order with the names swapped. Write from the source facts in our order.

## Length

Character counts are `lengthNorm` in `apps/web-app/shared/scoring.ts` and ADR 0016. Venue length is `venueQuality` in the same file. Do not invent a new target. ADR 0034 is the only way past a ceiling.

| Page | Body | Extended ceiling |
| --- | --- | --- |
| Major place (`forty`, `zamki`) | 3000–6000 | up to 20000 |
| Other place | 2000–6000 | up to 20000 |
| Route | 8000–12000 | up to 20000 |
| Collection | 5000–8000 | up to 20000 |
| Quest | 2000–4000 | up to 20000 |
| Hub | 2000–8000 | up to 20000 |
| Venue `description` | 300–600 | none |

Do not pad a page to reach the minimum. A short sourced page stays short. The score may flag it. Padding is a failure, and so is stuffing past the ceiling.

A longer page is earned by search demand plus facts. `page_passport_set` stores `lengthOverride` only when all of these are present:

- `ceiling`: above that page's default, at most 20000
- `queries`: the searches the extra length should rank for
- evidence: `search` with observed impressions and position from `analytics_search_queries` (Webmaster or Search Console), or `competitors` with the length of the top page for each query
- `sections`: the extra sections that length covers

Without that justification the default ceiling applies. Each added section needs its own sourced facts. Do not reuse a paragraph, and do not paste a near-copy under a new heading. The score flags a page above the default ceiling when an H2 repeats, a paragraph is a near-duplicate, or the stop-list matches. An override with no search impressions after 60 days is a reason to cut the page back. The weekly report lists those pages with their traffic.

The rendered title (with `| K39`) is 30–65 characters. The description is 110–160. Outside that, the score flags the page. `content_guide` still caps stored `seoTitle` at 70 and `seoDescription` at 170. Do not keyword-stuff. The H1 is the page title.

## Structure

Place order is ADR 0020. Do not add blocks.

1. Summary: one or two sentences, what it is and why a visitor stops.
2. «Коротко»: `visitDuration`, `bestTime`, hours, price, address. Empty fields hide. Example shape: «1–2 часа», «май–сентябрь, утром». Ticket prices are rows (`admission_set`, ADR 0046): once they exist, «Билеты» replaces `price`, so clear that field.
3. Article sections (ADR 0027): intro, then only sections the sources support. `useful` renders «Полезно знать». `directions` renders «Как добраться».
4. Hours are a schedule (ADR 0028), not a guessed sentence. `howToGet` is the short address only. Ticket amounts and event dates live in the rows (`admission_set`, `event_upsert`) and render in «Билеты» and «Ближайшее». Do not repeat them in the body. A dated closure, relocation, or renovation goes to `notices_set` (ADR 0049), not into prose. Notice text has no relative words («сейчас», «временно», «до конца месяца»), hours, or prices: the dates print themselves.
5. «Вопросы перед поездкой», then «Источники».

Routes, collections, and quests: ordered stops that already exist, then the practical bits (how to get there, what it costs). A collection whose stops share one region does not need a directions heading. Module pages: ADR 0023 and `content_guide`. Reuse existing prose when moving an article into modules. Edit `modules`. `body` is derived from them and is not a second article. A different `body` is rejected. The stop-list applies to that module text.

Venues: `k39-venue-page` and `docs/venue-modules.md`. The description is the archive. Modules hold the page.

Do not paste the summary again as the first paragraph. An exact repeat is stripped (`stripRepeatedLead` in `shared/seo.ts`). A near-copy still shows twice.

## FAQ

- Place: the `faq` field, 3 to 6 questions a visitor would ask. Each answer uses only facts already in `sources`. When `faq` is set, do not also put `## Частые вопросы` in the body (ADR 0020).
- Hub, route, collection, quest: `## Частые вопросы` in the body. A question is a line `**…?**` or a `###` heading. The next `##` ends the section. The score wants 6 questions. A place counts the structured `faq` field first (`pageFaq` in `shared/scoring.ts`). The body section is the fallback when that field is empty.
- A text module with `role: faq` is not rendered (ADR 0025). Do not hide the only FAQ there.
- Venue: the `faq` module, at most 8, answers from known facts. Venues are not scored on article FAQ.

The place score counts the structured `faq` field. Do not copy those questions into the body to clear the check.

## Examples

Bad:

> Форт №5 — это уютная атмосфера и настоящее гастрономическое путешествие, где каждый найдёт идеальное место. Здесь не просто стены, а история, которую вкусно, душевно и атмосферно хочется рассматривать.

Good, and only with those facts in sources:

> Форт №5 стоит у окружной дороги. Его строили с 1872 по 1892 год. Во дворе слышно шоссе. Билет 200 ₽, касса с 10:00 до 18:00.

Bad: «Идеальное место для всей семьи, каждый найдет занятие.»

Good: «Во внутреннем дворе есть стол и две скамьи. Детский билет 100 ₽.»

## Checklist

- Every sentence is a fact a source states, or it is absent.
- Stop-list phrases, empty superlatives, triads, «не просто X, а Y», and em dashes are gone.
- `kgdmore.ru` is not named. No sentence is copied from another site.
- Length is inside the table, or inside a justified passport override (at most 20000) whose extra sections each have their own sourced facts.
- Place FAQ is the `faq` field (3 to 6), not a second body section. Other articles use `## Частые вопросы` with 6 questions.
- Summary is not repeated as the opening paragraph.
- With ticket rows or events stored, `price` is empty and the body does not repeat their amounts or dates.
- `seoTitle` and `seoDescription` sit in the score window.
