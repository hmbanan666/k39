export const BODY_LINE_MAX = 100

export function bodyWrapResult(body) {
  if (!body) {
    return [true]
  }
  const lines = body.split(/\r?\n/)
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (line.length > BODY_LINE_MAX) {
      return [false, wrapHint(index + 1, line.length)]
    }
  }
  return [true]
}

function wrapHint(lineNumber, length) {
  return [
    `body line ${lineNumber} is ${length} characters; the limit is ${BODY_LINE_MAX}.`,
    'Wrap the body so every line is at most 100 characters.',
    'lint-staged may already have formatted the index; those fixes stay staged.',
    'Commit again with a wrapped body. Example:',
    '',
    'feat: short subject',
    '',
    'First sentence of the body, wrapped before',
    'it reaches one hundred characters.',
  ].join('\n')
}
