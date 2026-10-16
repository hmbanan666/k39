import antfu from '@antfu/eslint-config'

export default antfu(
  {
    vue: true,
    rules: {
      'style/brace-style': ['error', '1tbs'],
      'style/arrow-parens': ['error', 'always'],
      'curly': ['error', 'all'],
      'antfu/consistent-list-newline': 'off',
      'ts/consistent-type-definitions': 'off',
      'no-undef': 'off',
      'vue/block-order': ['error', {
        order: ['template', 'script', 'style'],
      }],
      'vue/max-attributes-per-line': ['error', {
        singleline: 2,
        multiline: 1,
      }],
      'ts/no-use-before-define': 'off',
      // pnpm rewrites flow sequences with a space inside the brackets.
      'yml/flow-sequence-bracket-spacing': ['error', 'always'],
      'yml/flow-mapping-curly-spacing': ['error', 'always'],
    },
  },
  {
    ignores: ['.github/**', 'apps/web-app/public/collect.js'],
  },
)
