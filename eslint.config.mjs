import tsParser from '@typescript-eslint/parser'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

// Oxlint cannot lint Vue templates yet. Keep this check scoped to SFCs;
// general JS/TS lint and all formatting belong to the root Vite+ config.
export default [
  { ignores: ['**/node_modules/**', '**/.nuxt/**', '**/.output/**', '**/dist/**'] },
  ...vue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsParser, extraFileExtensions: ['.vue'], sourceType: 'module' },
    },
    rules: {
      'vue/multi-word-component-names': 'off', // Nuxt route filenames are component names.
      'vue/block-order': ['error', { order: ['template', 'script', 'style'] }],
      'vue/no-template-shadow': 'warn',
      'vue/no-unused-refs': 'error',
      'vue/no-useless-v-bind': 'error',
      'vue/no-lone-template': 'warn',
      'vue/no-required-prop-with-default': 'warn',
      'vue/require-explicit-emits': 'warn',
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/custom-event-name-casing': ['error', 'camelCase'],
      'vue/prefer-separate-static-class': 'error',
      'vue/no-restricted-v-bind': ['error', '/^v-/'],
      'vue/eqeqeq': ['error', 'smart'],
      'vue/no-empty-pattern': 'error',
      'vue/no-irregular-whitespace': 'error',
      'vue/no-loss-of-precision': 'error',
      'vue/no-sparse-arrays': 'error',
    },
  },
]
