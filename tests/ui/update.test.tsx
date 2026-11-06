import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finishSession, startEmptySession } from '../../src/data/sessions';
import { seedIfNeeded } from '../../src/data/seed';
import { updateCheckDue } from '../../src/pwa/useAppUpdate';
import { testContext } from '../unit/data/helpers';
import { renderApp } from './helpers';
import { pwaStub } from './pwa-register-stub';

const HOUR = 60 * 60 * 1000;

const toast = () => document.querySelector('ion-toast') as HTMLIonToastElement | null;
const expectToast = (open: boolean) => waitFor(() => expect(toast()?.isOpen ?? false).toBe(open));

function toastButton(text: string): HTMLButtonElement {
  const buttons = [...(toast()?.shadowRoot?.querySelectorAll('button') ?? [])];
  const button = buttons.find((b) => b.textContent?.trim() === text);
  if (!button) throw new Error(`No toast button ${text}`);
  return button;
}

describe('update toast', () => {
  beforeEach(() => {
    pwaStub.waiting = true;
    pwaStub.updateServiceWorker.mockClear();
  });
  afterEach(() => {
    pwaStub.waiting = false;
  });

  it('stays closed with no update waiting', async () => {
    pwaStub.waiting = false;
    renderApp();
    await screen.findByText('Bodyweight');
    await expectToast(false);
  });

  it('offers the update, and Update applies it', async () => {
    renderApp();
    await expectToast(true);
    expect(toast()?.message).toBe('Update available');
    await waitFor(() => toastButton('Update'));
    toastButton('Update').click();
    await waitFor(() => expect(pwaStub.updateServiceWorker).toHaveBeenCalledWith(true));
  });

  it('Later closes it without updating', async () => {
    renderApp();
    await expectToast(true);
    await waitFor(() => toastButton('Later'));
    toastButton('Later').click();
    await expectToast(false);
    expect(pwaStub.updateServiceWorker).not.toHaveBeenCalled();
  });

  it('waits for an active workout to end', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const session = await startEmptySession(ctx);
    renderApp('/tabs/today', ctx);
    await screen.findByText('Resume workout');
    await expectToast(false);
    await finishSession(ctx, session.session.id);
    await expectToast(true);
  });

  it('closes when a workout starts while it shows', async () => {
    const { ctx } = renderApp();
    await expectToast(true);
    await startEmptySession(ctx);
    await expectToast(false);
  });
});

describe('update check', () => {
  it('waits an hour, and needs a connection', () => {
    expect(updateCheckDue(0, HOUR - 1, true)).toBe(false);
    expect(updateCheckDue(0, HOUR, true)).toBe(true);
    expect(updateCheckDue(0, HOUR, false)).toBe(false);
  });

  it('looks for a new version on return to the app, at most once an hour', async () => {
    const update = vi.fn(async () => undefined);
    const dateNow = vi.spyOn(Date, 'now');
    renderApp();
    await screen.findByText('Bodyweight');
    pwaStub.options?.onRegisteredSW?.('sw.js', { update } as unknown as ServiceWorkerRegistration);
    const start = Date.now();

    dateNow.mockReturnValue(start + HOUR - 1000);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).not.toHaveBeenCalled();

    dateNow.mockReturnValue(start + HOUR + 1000);
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(1);
    dateNow.mockRestore();
  });

  it('survives a failed check', async () => {
    const update = vi.fn(async () => {
      throw new Error('offline');
    });
    const dateNow = vi.spyOn(Date, 'now');
    renderApp();
    await screen.findByText('Bodyweight');
    pwaStub.options?.onRegisteredSW?.('sw.js', { update } as unknown as ServiceWorkerRegistration);
    dateNow.mockReturnValue(Date.now() + 2 * HOUR);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(1);
    dateNow.mockRestore();
    await screen.findByText('Bodyweight');
  });
});
