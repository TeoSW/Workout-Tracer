import { useState } from 'react';
import { vi } from 'vitest';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

/** Stands in for the plugin's virtual module, which only exists in a real build. */
export const pwaStub = {
  waiting: false,
  updateServiceWorker: vi.fn(async () => undefined),
  options: undefined as RegisterSWOptions | undefined,
};

export function useRegisterSW(options: RegisterSWOptions) {
  pwaStub.options = options;
  return {
    needRefresh: useState(pwaStub.waiting),
    offlineReady: useState(false),
    updateServiceWorker: pwaStub.updateServiceWorker,
  };
}
