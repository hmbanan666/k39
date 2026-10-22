import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/** Same trailer policy on macOS and Linux, without incompatible sed -i flags. */
export function cleanCommitMessage(message) {
  const lines = message.split(/\r?\n/).filter((line) => !/^co-authored-by:/i.test(line))
  while (lines.length && !lines.at(-1).trim()) {
    lines.pop()
  }
  return lines.length ? `${lines.join('\n')}\n` : ''
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const path = process.argv[2]
  if (!path) {
    throw new Error('Usage: node scripts/git/clean-commit-message.mjs <message-file>')
  }
  const cleaned = cleanCommitMessage(readFileSync(path, 'utf8'))
  if (!cleaned.trim()) {
    throw new Error('Refusing to empty the commit message')
  }
  writeFileSync(path, cleaned)
}
