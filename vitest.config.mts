import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

loadEnv({ path: path.resolve(import.meta.dirname, '.env.local'), quiet: true });
loadEnv({ path: path.resolve(import.meta.dirname, '.env'), quiet: true });

const alias = { '@': path.resolve(import.meta.dirname, 'src') };

export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.ts'],
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'reports/vitest-junit.xml' },
    coverage: {
      provider: 'v8',
      include: ['src/server/services/**/*.ts', 'src/lib/**/*.ts', 'src/server/dto/**/*.ts'],
      // auth-client 为纯浏览器模块（Better Auth React client），不在 node 单测范围
      exclude: ['**/*.d.ts', 'src/lib/auth-client.ts'],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      thresholds: { statements: 80, branches: 70, functions: 80, lines: 80 },
      reportOnFailure: true,
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
          setupFiles: ['./tests/setup-node.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          // service 层单例 db 读取 DATABASE_URL：单测里统一指向测试库
          env: { NODE_ENV: 'test', DATABASE_URL: process.env.DATABASE_URL_TEST ?? '' },
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['tests/component/**/*.test.tsx'],
          sequence: { groupOrder: 0 },
          setupFiles: ['./tests/setup-dom.ts'],
          css: false,
        },
      },
    ],
  },
});
