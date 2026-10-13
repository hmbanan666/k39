import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { coverageConfigDefaults, defineConfig } from 'vitest/config'

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
        plugins: [vue()],
        resolve: {
          alias: {
            '~': fileURLToPath(new URL('./apps/web-app/app', import.meta.url)),
          },
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
