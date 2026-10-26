import { renderMarkdown } from './markdown'

/**
 * Authored article text, using the public renderer's supported Markdown.
 * Count UTF-16 units as before, with whitespace collapsed to one space.
 * Generated link marks are chrome, not authored text. Decode only entities
 * emitted by escapeHtml, once, after stripping generated tags.
 */
export function articleTextLength(source: string) {
  return renderMarkdown(source)
    .replace(/<sup class="meta-mark">\*<\/sup>/g, '')
    .replace(/<\/(?:p|h[23]|li|th|td)>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim().length
}
