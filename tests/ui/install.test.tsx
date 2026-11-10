import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAndroid, isStandalone } from '../../src/pwa/install';
import { getStorageStatus, requestPersistentStorage } from '../../src/pwa/storage';
import { renderApp } from './helpers';

const realMatchMedia = window.matchMedia;

function setStandalone(ios: boolean, displayMode = false) {
  Object.defineProperty(navigator, 'standalone', { value: ios, configurable: true });
  window.matchMedia = ((query: string) => ({
    ...realMatchMedia(query),
    matches: displayMode && query === '(display-mode: standalone)',
  })) as typeof window.matchMedia;
}

function setStorage(storage: Partial<StorageManager> | undefined) {
  Object.defineProperty(navigator, 'storage', { value: storage, configurable: true });
}

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36';

function setUserAgent(userAgent: string) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'userAgent');
  Reflect.deleteProperty(navigator, 'standalone');
  Reflect.deleteProperty(navigator, 'storage');
  window.matchMedia = realMatchMedia;
});

describe('standalone detection', () => {
  it('is false in a browser tab', () => {
    expect(isStandalone()).toBe(false);
  });

  it('sees the iPhone flag and the display mode', () => {
    setStandalone(true);
    expect(isStandalone()).toBe(true);
    setStandalone(false, true);
    expect(isStandalone()).toBe(true);
  });
});

describe('Android detection', () => {
  it('sees Android, and not an iPhone', () => {
    setUserAgent(ANDROID_CHROME);
    expect(isAndroid()).toBe(true);
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    );
    expect(isAndroid()).toBe(false);
  });
});

describe('install banner', () => {
  it('shows in a browser tab, with the warning', async () => {
    renderApp();
    expect(await screen.findByText('Install this app')).toBeInTheDocument();
    expect(screen.getByText(/^Tap Share, then Add to Home Screen./)).toBeInTheDocument();
    expect(screen.getByText(/won't appear in the installed app/)).toBeInTheDocument();
  });

  it('gives the Android steps on Android', async () => {
    setUserAgent(ANDROID_CHROME);
    renderApp();
    expect(await screen.findByText('Install this app')).toBeInTheDocument();
    expect(
      screen.getByText(/^Open the browser menu, then tap Install app or Add to Home screen./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/this browser tab won't appear in the installed app/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Safari|Tap Share/)).not.toBeInTheDocument();
  });

  it('is gone in the installed app', async () => {
    setStandalone(true);
    renderApp();
    await screen.findByText('Bodyweight');
    expect(screen.queryByText('Install this app')).not.toBeInTheDocument();
  });
});

describe('persistent storage request', () => {
  const persistentStorage = (persisted: boolean) => {
    const persist = vi.fn(async () => true);
    setStorage({ persist, persisted: vi.fn(async () => persisted) });
    return persist;
  };

  it('asks in the installed app', async () => {
    const persist = persistentStorage(false);
    setStandalone(true);
    await requestPersistentStorage();
    expect(persist).toHaveBeenCalledOnce();
  });

  it('runs at launch', async () => {
    const persist = persistentStorage(false);
    setStandalone(true);
    renderApp();
    await waitFor(() => expect(persist).toHaveBeenCalledOnce());
  });

  it('does not ask in a tab, since data there will not be kept', async () => {
    const persist = persistentStorage(false);
    await requestPersistentStorage();
    expect(persist).not.toHaveBeenCalled();
  });

  it('does not ask again once granted', async () => {
    const persist = persistentStorage(true);
    setStandalone(true);
    await requestPersistentStorage();
    expect(persist).not.toHaveBeenCalled();
  });

  it('copes without the API, and with one that fails', async () => {
    setStandalone(true);
    setStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBeUndefined();
    setStorage({
      persisted: vi.fn(async () => false),
      persist: vi.fn(async () => {
        throw new Error('Not allowed');
      }),
    });
    await expect(requestPersistentStorage()).resolves.toBeUndefined();
  });

  it('shows the status when the app opens on Settings', async () => {
    setStorage({ persisted: vi.fn(async () => false) });
    renderApp('/tabs/settings');
    expect(await screen.findByText('Not persistent')).toBeInTheDocument();
  });

  it('shows the new status each time Settings opens', async () => {
    const persisted = vi.fn(async () => false);
    setStorage({
      persisted,
      estimate: vi.fn(async () => ({ usage: 2_000_000, quota: 4_000_000 })),
    });
    expect((await getStorageStatus()).persisted).toBe(false);

    const { user } = renderApp();
    await screen.findByText('Bodyweight');
    await user.click(document.querySelector('ion-tab-button[tab="settings"]') as Element);
    expect(await screen.findByText('Not persistent')).toBeInTheDocument();
    persisted.mockResolvedValue(true);
    await user.click(document.querySelector('ion-tab-button[tab="today"]') as Element);
    await waitFor(() => expect(window.location.hash).toBe('#/tabs/today'));
    await user.click(document.querySelector('ion-tab-button[tab="settings"]') as Element);
    expect(await screen.findByText('Persistent')).toBeInTheDocument();
  });
});
