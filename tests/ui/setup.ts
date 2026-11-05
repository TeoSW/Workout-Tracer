// Dexie's liveQuery needs a global indexedDB, even though each test passes its own factory.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { setupIonicReact } from '@ionic/react';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

setupIonicReact({ mode: 'ios' });

afterEach(() => cleanup());

// jsdom has no matchMedia, and Ionic uses it for platform and dark mode checks.
window.matchMedia =
  window.matchMedia ||
  ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList);
