let wanted = false;
let sentinel: WakeLockSentinel | null = null;

export function isWakeLockSupported(): boolean {
  return 'wakeLock' in navigator;
}

async function request(): Promise<void> {
  if (sentinel && !sentinel.released) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
  } catch {
    // Refused, for example on low battery. The workout carries on without it.
    sentinel = null;
  }
}

// iOS drops the lock when the app leaves the screen, so it is requested again on return.
function onVisibilityChange(): void {
  if (wanted && document.visibilityState === 'visible') void request();
}

/** Keeps the screen on during a workout where the browser allows it. */
export async function keepAwake(): Promise<void> {
  if (!isWakeLockSupported()) return;
  if (!wanted) document.addEventListener('visibilitychange', onVisibilityChange);
  wanted = true;
  await request();
}

export async function allowSleep(): Promise<void> {
  if (wanted) document.removeEventListener('visibilitychange', onVisibilityChange);
  wanted = false;
  await sentinel?.release();
  sentinel = null;
}

export function resetWakeLockForTests(): void {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  wanted = false;
  sentinel = null;
}
