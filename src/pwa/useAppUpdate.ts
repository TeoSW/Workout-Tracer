import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_EVERY_MS = 60 * 60 * 1000;

export function updateCheckDue(lastCheckMs: number, nowMs: number, online: boolean): boolean {
  return online && nowMs - lastCheckMs >= CHECK_EVERY_MS;
}

export type AppUpdate = { waiting: boolean; apply: () => void; dismiss: () => void };

/**
 * Registers the service worker and reports a new version waiting to start. An installed iPhone
 * app can stay in memory for days, so it also looks for one when it comes back to the foreground.
 */
export function useAppUpdate(): AppUpdate {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const {
    needRefresh: [waiting, setWaiting],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, r) => {
      registration.current = r;
    },
  });

  useEffect(() => {
    let lastCheck = Date.now();
    const check = () => {
      const now = Date.now();
      if (document.visibilityState !== 'visible') return;
      if (!registration.current || !updateCheckDue(lastCheck, now, navigator.onLine)) return;
      lastCheck = now;
      // A failed check changes nothing, and the next return to the app tries again.
      registration.current.update().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

  return {
    waiting,
    apply: () => void updateServiceWorker(true),
    dismiss: () => setWaiting(false),
  };
}
