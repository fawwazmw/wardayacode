import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // The CLI entry point is wiring (spawned by the CI smoke test, not
      // unit-tested) and types.ts is type-only.
      exclude: ['src/**/*.tsx', 'src/ui/**', 'src/cli.ts', 'src/types.ts'],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 75,
      },
    },
  },
});
