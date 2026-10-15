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
- «каждый найдёт» and «каждый найдет»
- «гастрономическое путешествие»
- «настоящий» as an empty intensifier («настоящий борщ», «настоящая история»)

Patterns (`WRITING_STOP_PATTERNS`):

- empty superlatives: лучший, самый, уникальный, неповторимый, незабываемый, идеальный, with no measured fact
- triads: three adjectives or three nouns in a row («вкусно, душевно и атмосферно»)
- «не просто X, а Y»
- an em dash (the character —) in body copy, UI chrome, or the HTML title. Use a period, a comma, a colon, or parentheses.

Never name `kgdmore.ru` (`WRITING_BANNED_SITES`). Do not link it and do not use it as a source.

Never paste another site's sentences, and do not keep their sentence order with the names swapped. Write from the source facts in our order.

## Length

Character counts are `lengthNorm` in `apps/web-app/shared/scoring.ts` and ADR 0016. Venue length is `venueQuality` in the same file. Do not invent a new target.

| Page | Body |
| --- | --- |
| Major place (`forty`, `zamki`) | 3000–6000 |
| Other place | at least 2000, no ceiling |
| Route | 8000–12000 |
| Collection | 5000–8000 |
| Quest | 2000–4000 |
| Hub | at least 2000, no ceiling |
| Venue `description` | 300–600 |

The rendered title (with `| K39`) is 30–65 characters. The description is 110–160. Outside that, the score flags the page. `content_guide` still caps stored `seoTitle` at 70 and `seoDescription` at 170. Do not keyword-stuff. The H1 is the page title.

## Structure

Place order is ADR 0020. Do not add blocks.

1. Summary: one or two sentences, what it is and why a visitor stops.
2. «Коротко»: `visitDuration`, `bestTime`, hours, price, address. Empty fields hide. Example shape: «1–2 часа», «май–сентябрь, утром».
3. Article sections (ADR 0027): intro, then only sections the sources support. `useful` renders «Полезно знать». `directions` renders «Как добраться».
4. Hours are a schedule (ADR 0028), not a guessed sentence. `howToGet` is the short address only.
5. «Вопросы перед поездкой», then «Источники».

Routes, collections, and quests: ordered stops that already exist, then the practical bits (how to get there, what it costs). A collection whose stops share one region does not need a directions heading. Module pages: ADR 0023 and `content_guide`. Reuse existing prose when moving an article into modules.

Venues: `k39-venue-page` and `docs/venue-modules.md`. The description is the archive. Modules hold the page.

Do not paste the summary again as the first paragraph. An exact repeat is stripped (`stripRepeatedLead` in `shared/seo.ts`). A near-copy still shows twice.

## FAQ

- Place: the `faq` field, 3 to 6 questions a visitor would ask. Each answer uses only facts already in `sources`. When `faq` is set, do not also put `## Частые вопросы` in the body (ADR 0020).
- Hub, route, collection, quest: `## Частые вопросы` in the body. A question is a line `**…?**` or a `###` heading. The next `##` ends the section. The score wants 6 questions (`faqFromBody` in `shared/scoring.ts`).
- A text module with `role: faq` is not rendered (ADR 0025). Do not hide the only FAQ there.
- Venue: the `faq` module, at most 8, answers from known facts. Venues are not scored on article FAQ.

The place score counts a body heading only. A place that follows ADR 0020 can show `no FAQ`. Do not copy the questions into the body to clear that check. The reviewer notes it (`k39-publish-review`).

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
- Length is inside the table for this page type.
- Place FAQ is the `faq` field (3 to 6), not a second body section. Other articles use `## Частые вопросы` with 6 questions.
- Summary is not repeated as the opening paragraph.
- `seoTitle` and `seoDescription` sit in the score window.
