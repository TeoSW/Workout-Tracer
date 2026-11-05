import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Fixed timezone so date tests behave the same on Windows and Linux,
// and so DST changes in Romania are exercised.
process.env.TZ = 'Europe/Bucharest';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        plugins: [react()],
        test: {
          name: 'ui',
          include: ['tests/ui/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/ui/setup.ts'],
        },
      },
    ],
  },
});
