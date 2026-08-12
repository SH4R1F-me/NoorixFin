import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // happy-dom rather than jsdom: these tests assert on the accessibility
    // tree and on focus, both of which it implements, and it starts in a
    // fraction of the time on a machine already running eleven containers.
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
  },
});
