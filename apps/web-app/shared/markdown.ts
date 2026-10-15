import { externalLinkAttrs } from './links'
import { metaMarkHtml } from './meta-links'
import { headingId } from './reader-nav'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function anchor(label: string, href: string) {
  const attrs = externalLinkAttrs(href)
  const extra = attrs.target ? ` target="${attrs.target}" rel="${attrs.rel}"` : ''
  return `<a href="${href}"${extra}>${label}${metaMarkHtml(href)}</a>`
}

function inline(value: string) {
  const safe = escapeHtml(value)
  return safe
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, (_match, label: string, href: string) => anchor(label, href))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
}

function tableCells(line: string) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

function isTableSeparator(line: string) {
  const cells = tableCells(line)
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function isTableRow(line: string) {
  const trimmed = line.trim()
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2
}

function renderTable(rows: string[]) {
  const header = tableCells(rows[0] ?? '')
  const body = rows.slice(2).map(tableCells)
  const head = `<thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead>`
  const cells = body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')
  return `<div class="table-scroll"><table>${head}<tbody>${cells}</tbody></table></div>`
}

export function renderMarkdown(source: string, options?: { headingPrefix?: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  const usedIds = new Map<string, number>()
  const headingPrefix = options?.headingPrefix ?? ''
  let list: 'ul' | 'ol' | null = null
  const closeList = () => {
    if (list) {
      html.push(`</${list}>`)
      list = null
    }
  }
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()
    if (!trimmed) {
      closeList()
      continue
    }
    if (isTableRow(trimmed) && isTableSeparator(lines[index + 1] ?? '')) {
      closeList()
      const rows = [trimmed]
      index += 1
      rows.push((lines[index] ?? '').trim())
      while (isTableRow(lines[index + 1] ?? '')) {
        index += 1
        rows.push((lines[index] ?? '').trim())
      }
      html.push(renderTable(rows))
      continue
    }
    const heading = /^(#{2,3})[ \t]+(\S.*)$/.exec(trimmed)
    if (heading) {
      closeList()
      const level = heading[1]?.length === 2 ? 'h2' : 'h3'
      const id = headingId(heading[2] ?? '', usedIds, headingPrefix)
      html.push(`<${level} id="${id}">${inline(heading[2] ?? '')}</${level}>`)
      continue
    }
    const unordered = /^[-*][ \t]+(\S.*)$/.exec(trimmed)
    if (unordered) {
      if (list !== 'ul') {
        closeList()
        list = 'ul'
        html.push('<ul>')
      }
      html.push(`<li>${inline(unordered[1] ?? '')}</li>`)
      continue
    }
    const ordered = /^\d+\.[ \t]+(\S.*)$/.exec(trimmed)
    if (ordered) {
      if (list !== 'ol') {
        closeList()
        list = 'ol'
        html.push('<ol>')
      }
      html.push(`<li>${inline(ordered[1] ?? '')}</li>`)
      continue
    }
    closeList()
    html.push(`<p>${inline(trimmed)}</p>`)
  }
  closeList()
  return html.join('\n')
}
