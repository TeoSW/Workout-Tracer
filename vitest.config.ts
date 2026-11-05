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
        // @lit/react, under Ionic's components, ships a server build that never attaches events.
        resolve: { conditions: ['browser'] },
        test: {
          name: 'ui',
          testTimeout: 30_000,
          server: {
            deps: { inline: ['@ionic/react', '@stencil/react-output-target', '@lit/react'] },
          },
          include: ['tests/ui/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/ui/setup.ts'],
        },
      },
    ],
  },
});
