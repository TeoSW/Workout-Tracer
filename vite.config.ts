import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Must match the GitHub Pages repo path. Settled in Milestone 6. */
const BASE_PATH = '/workout-tracker/';

export default defineConfig({
  plugins: [react()],
  base: BASE_PATH,
});
