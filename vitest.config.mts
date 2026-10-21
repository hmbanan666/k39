import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { coverageConfigDefaults, defineConfig } from 'vitest/config'
import { nuxtSfcTestPlugin } from './apps/web-app/test/nuxt-sfc-plugin.ts'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'packages/map',
          root: './packages/map',
          environment: 'node',
          include: ['test/**/*.test.ts'],
        },
      },
      {
        test: {
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
        plugins: [nuxtSfcTestPlugin(), vue()],
        resolve: {
          alias: [
            { find: '~~', replacement: fileURLToPath(new URL('./apps/web-app', import.meta.url)) },
            { find: '~', replacement: fileURLToPath(new URL('./apps/web-app/app', import.meta.url)) },
          ],
        },
        test: {
          name: 'web-app',
          root: './apps/web-app',
          environment: 'happy-dom',
          include: ['test/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      exclude: [
        '**/{nitro,release,nuxt,app,drizzle}.config.*',
        ...coverageConfigDefaults.exclude,
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
