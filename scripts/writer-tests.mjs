/**
 * Repository tests that import the web-app server.
 * `packages/database/tsconfig.json` excludes the same suffix under
 * `src/repository/test`. `scripts/typecheck-writer.mjs` includes this glob.
 */
export const WRITER_TEST_GLOB = 'packages/database/src/repository/test/**/*.writer.test.ts'

const splitAt = WRITER_TEST_GLOB.indexOf('**')
const writerRoot = WRITER_TEST_GLOB.slice(0, splitAt)
const writerSuffix = WRITER_TEST_GLOB.slice(splitAt + '**'.length).replace(/^\//, '').replace(/^\*/, '')

export function isWriterTest(file) {
  const path = String(file).replaceAll('\\', '/')
  return path.startsWith(writerRoot) && path.endsWith(writerSuffix)
}
