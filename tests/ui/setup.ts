// Dexie's liveQuery needs a global indexedDB, even though each test passes its own factory.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { setupIonicReact } from '@ionic/react';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

setupIonicReact({ mode: 'ios' });

// A first render seeds the database, which takes a while when every test file runs at once,
// and longer on GitHub's slower runners.
configure({ asyncUtilTimeout: 15_000 });

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

// jsdom has no layout, and Ionic's gestures ask for the element under a point.
document.elementFromPoint = () => null;
