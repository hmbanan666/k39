function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(value: string) {
  const safe = escapeHtml(value)
  return safe
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
}

export function renderMarkdown(source: string) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let list: 'ul' | 'ol' | null = null
  const closeList = () => {
    if (list) {
      html.push(`</${list}>`)
      list = null
    }
  }
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      closeList()
      continue
    }
    const heading = /^(#{2,3})[ \t]+(\S.*)$/.exec(trimmed)
    if (heading) {
      closeList()
      const level = heading[1]?.length === 2 ? 'h2' : 'h3'
      html.push(`<${level}>${inline(heading[2] ?? '')}</${level}>`)
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
