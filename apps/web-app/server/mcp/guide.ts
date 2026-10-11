export const CONTENT_GUIDE = `K39 place pages are Russian. Write for a visitor who will go there, not for a brochure.

Tone: plain, specific, calm. No slogans, no "лучший", no invented atmosphere. Do not use an em dash in body copy.

Structure:
- summary: one or two sentences, what the place is and why a visitor stops.
- body: markdown. First paragraph states what it is and when it was built or opened, only if a source says so. Then a heading "## Как добраться" with the practical route. Optional heading "## Что посмотреть" only for things named in sources.
- hours, price, howToGet: copy from sources or leave empty. Never guess a timetable or a ticket price.
- status: open, ruins, closed, or unknown. unknown if the source does not say.

Facts: if a source does not state it, do not write it. Coordinates, names, and dates come from the source list. Put each source in sources as { title, url }.

SEO: seoTitle stays under 70 characters, seoDescription under 170. The visible H1 is the place title. Do not keyword-stuff. publicationStatus may be draft or review. Publishing is human-only in /admin.

Photos: alt is required and describes the picture. author, license, and sourceUrl are required for an upload. Do not attach a photo whose license is not own, cc-by, cc-by-sa, cc0, pd, or permission.
`

export function contentGuideMessages() {
  return {
    messages: [{
      role: 'user' as const,
      content: { type: 'text' as const, text: CONTENT_GUIDE },
    }],
  }
}
