import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { coverageConfigDefaults, defineConfig } from 'vite-plus'
import { nuxtSfcTestPlugin } from './apps/web-app/test/nuxt-sfc-plugin.ts'

export default defineConfig({
  // Nuxt/Vue types still require the package typechecks, including generated Nitro types.
  lint: {
    plugins: ['typescript', 'unicorn', 'import'],
    categories: { correctness: 'error' },
    env: { builtin: true, browser: true, node: true },
    ignorePatterns: ['apps/web-app/public/**', 'docs/reviews/**'],
    rules: {
      'no-undef': 'off', // Nuxt auto-imports are checked by nuxt typecheck.
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'smart'],
      'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true, caughtErrors: 'none' }],
      'import/no-duplicates': 'error',
      'typescript/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports', disallowTypeAnnotations: false },
      ],
      'typescript/no-import-type-side-effects': 'error',
      'unicorn/prefer-node-protocol': 'error',
    },
    overrides: [
      {
        files: ['**/*.vue'],
        // eslint-plugin-vue retains Vue script and template semantics until Oxlint supports both.
        plugins: ['vue'],
      },
    ],
  },
  fmt: {
    semi: false,
    singleQuote: true,
    quoteProps: 'consistent',
    printWidth: 120,
    arrowParens: 'always',
    singleAttributePerLine: true,
    // Preserve existing Vue text-node whitespace during source formatting.
    htmlWhitespaceSensitivity: 'strict',
    sortImports: false,
    sortPackageJson: false,
    // Historical decisions/evidence, lockfile, generated public assets and brand binaries are not reformatted.
    ignorePatterns: [
      'pnpm-lock.yaml',
      'packages/database/migrations/REGISTRY.md',
      'docs/adr/**',
      'docs/reviews/**',
      '.agents/skills/**',
      '.cursor/rules/**',
      'apps/web-app/public/**',
    ],
  },
  test: {
    // Preserve v4 mock history: several suites use beforeAll/shared module mocks.
    clearMocks: false,
    // The database setup and Nuxt SFC plugin require independent project servers.
    sharedViteServer: false,
    projects: [
      {
        extends: false,
        test: {
          clearMocks: false,
          name: 'packages/map',
          root: './packages/map',
          environment: 'node',
          include: ['test/**/*.test.ts'],
        },
      },
      {
        extends: false,
        resolve: {
          alias: [
            { find: '~~', replacement: fileURLToPath(new URL('./apps/web-app', import.meta.url)) },
            { find: '~', replacement: fileURLToPath(new URL('./apps/web-app/app', import.meta.url)) },
          ],
        },
        test: {
          clearMocks: false,
          name: 'packages/database',
          root: './packages/database',
          environment: 'node',
          fileParallelism: false,
          setupFiles: ['./test/setup.ts'],
          hookTimeout: 120_000,
          testTimeout: 30_000,
        },
      },
      {
        extends: false,
        plugins: [nuxtSfcTestPlugin(), vue()],
        resolve: {
          alias: [
            { find: '~~', replacement: fileURLToPath(new URL('./apps/web-app', import.meta.url)) },
            { find: '~', replacement: fileURLToPath(new URL('./apps/web-app/app', import.meta.url)) },
          ],
        },
        test: {
          clearMocks: false,
          name: 'web-app',
          server: { deps: { inline: ['@nuxtjs/mcp-toolkit'] } },
          root: './apps/web-app',
          environment: 'happy-dom',
          include: ['test/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      exclude: ['**/{nitro,release,nuxt,app,drizzle}.config.*', ...coverageConfigDefaults.exclude],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
