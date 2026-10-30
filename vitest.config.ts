import { defineConfig } from 'vitest/config';

// Fixed timezone so date tests behave the same on Windows and Linux,
// and so DST changes in Romania are exercised.
process.env.TZ = 'Europe/Bucharest';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
