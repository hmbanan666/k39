# ADR 0022: Reader navigation and the partner slot

## Status

Accepted.

## Context

Place, route, and collection pages (including month guides) are long articles. The body is markdown rendered to HTML. A reader on a phone or a wide screen has no way to see the sections or jump to one. The sticky header covers an in-page target that scrolls flush to the top of the viewport.

ADR 0018 already ranks one sponsored venue first in «Где поесть рядом» when `FEATURE_SPONSORED_VENUES=true`. That flag stays off. A reading page still needs a single place where a later partner offer can sit, without a blank frame or a placeholder ad while the flag is off.

The page width is the existing `.page` / `.page-wide` container (`--page` / `--wide`), the same measure as the footer. The header on main is full-bleed and does not share that container. The reader rail lives inside the page container.

## Decision

### Table of contents

`renderMarkdown` writes a stable `id` on every `h2` and `h3`. The id is `transliterateSlug` of the plain heading text, so Cyrillic maps to the same latin slugs the rest of the site uses. A slug that would start with a digit is prefixed with `s-`. A second heading with the same slug gets `-2`, then `-3`. A directions block rendered on the same page uses the prefix `directions-` so its ids do not collide with the article.

`ReaderLayout` is the shared shell for a place, a route, and a collection. It reads the table of contents from the rendered body. An `h3` is nested under the previous `h2`. The table is shown only when the body has at least three `h2` sections. Fewer than that leaves the previous place layout: the article and the «Коротко» column from 1000px.

The table is in the server HTML. Each entry is an `<a href="#id">`. `scroll-behavior: smooth` is set on `html`. `prefers-reduced-motion: reduce` already forces `scroll-behavior: auto`. Headings in `.prose` set `scroll-margin-top` from `--site-header-offset`, so the sticky header does not cover the target.

From 1100px the shell is two columns. The article column is at most 70ch. The other column is a rail, `minmax(16rem, 22.5rem)`, in normal flow, so it does not cover the article. On a place page the rail starts with «Коротко». Under that, the table of contents sticks below the header. The active section is the last heading that has reached that line. `IntersectionObserver` updates `aria-current="location"`. With JavaScript disabled the links still work and no section is marked current.

Below 1100px the table is a closed `<details>` whose summary is «Содержание». On a place page it is the first block after «Коротко». On a route it follows the route guide. On a collection it is the first block of the article.

### Partner slot

`ReaderPartnerSlot` accepts an optional `partner`:

```ts
interface ReaderPartner {
  title: string
  terms: string
  href: string
  anchor?: string
}
```

If `partner` is missing or null, the component renders no element and reserves no height.

`readerPartner(enabled, candidate)` returns that object only when `enabled` is true and `title`, `terms`, and `href` are non-empty. Callers pass `enabled` from `FEATURE_SPONSORED_VENUES === 'true'`. The flag stays off. No page passes a candidate, so the slot is empty on every public page.

When a partner is passed, one copy is shown. From 1100px it is the last item in the rail, under the table of contents. Below that it is inserted after the first `h2` section of the body. The other copy is `display: none`. There is no placeholder, no reserved gap, and no «партнёр K39» label until the offer itself is rendered through `PartnerOffer`.

This is not the nearby ranking slot in ADR 0018. That slot still orders «Где поесть рядом». This one is a single offer on the reading page. A later choice of which offer wins should keep calling `readerPartner`, so the flag still gates the render.

## Consequences

Short articles do not gain a table of contents. Turning `FEATURE_SPONSORED_VENUES` on does not by itself show a partner: a caller still has to pass a complete candidate through `readerPartner`. The article measure on the desktop reader layout stays at 70ch.
