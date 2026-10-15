---
name: k39-ui
description: Use for any K39 UI change (Vue, CSS, layout, stickers, components). Read before the frontend-design skill. States K39 precedence and the screenshot check.
---

# K39 UI

Read this file, then `.cursor/skills/frontend-design/SKILL.md` for craft and anti-generic taste. `.cursor/rules/frontend-design.mdc` attaches that order to Vue and CSS files. The frontend-design file is Anthropic's skill, copied verbatim, with `LICENSE.txt` beside it.

When the two disagree, K39 wins. The short form is the UI section of `AGENTS.md`. Tokens, type, and color: ADR 0010 and `docs/design-system.md`.

## Precedence

- Keep the current tokens, type, and colors. Do not restyle the brand. Do not introduce the generic palettes the frontend-design skill warns about.
- Moose and food stickers go through `<Sticker>`. Catalogs and rules: `docs/stickers.md`, `docs/food-stickers.md`. Do not point a card at a file under `public/stickers/` on its own.
- One job, one box. Stickers that share a row share one size. Price cards and dish rows use the fixed 56×56 box (`PRICE_STICKER_WIDTH`, `object-fit: contain`). Do not size a sticker by the file's aspect ratio. Moose width is 96 to 200 CSS px. Do not stretch past 512.
- Block components own their styling and their stickers. Pass data. A venue module does not carry a sticker slug (`k39-venue-page`).
- Server-render the same HTML for bots and people. A fact that only appears after hydration is a bug.
- Prefer a simpler layout. Cut decoration that does not serve the page.

## Screenshots

A UI pull request includes before and after screenshots of the changed screen at 390px and 1440px (the widths in `docs/design-system.md`). Exercise the changed flow. A single picture of the happy state is not the check.

## Examples

Good: `<Sticker set="food" slug="cappuccino" :width="56" decorative />` inside the price card's 56×56 box.

Bad: `<img src="/stickers/food/beer-512.png">` at the file width, so the tall glass covers the title.

Good: `UiButton` on the existing brick token.

Bad: a new cream page and a terracotta accent taken from the frontend-design defaults.

## Checklist

- `k39-ui` and then `frontend-design` were read.
- Tokens, type, and colors are unchanged unless the task is a token change.
- Stickers use `<Sticker>` and the shared box for that row.
- The new text is in the server HTML.
- The layout is no more complex than the task needs.
- The PR has before and after screenshots at 390px and 1440px.
