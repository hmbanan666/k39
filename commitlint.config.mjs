import { bodyWrapResult } from './scripts/git/commitlint-body.mjs'

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'k39-body-wrap': (parsed) => bodyWrapResult(parsed.body),
      },
    },
  ],
  rules: {
    'body-max-line-length': [0],
    'k39-body-wrap': [2, 'always'],
  },
}
