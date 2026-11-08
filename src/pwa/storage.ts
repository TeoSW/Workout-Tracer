import { isStandalone } from './install';

export type StorageStatus = {
  /** Null when the browser cannot say. */
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
};

export async function getStorageStatus(): Promise<StorageStatus> {
  const storage = 'storage' in navigator ? navigator.storage : undefined;
  const persisted = (await storage?.persisted?.()) ?? null;
  const estimate = await storage?.estimate?.();
  return { persisted, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
}

/**
 * Asks to keep this app's data when the phone runs low on space. iOS decides without a prompt and
 * favors installed apps, so this runs on each launch of the installed app until it is granted.
 */
export async function requestPersistentStorage(): Promise<void> {
  if (!isStandalone()) return;
  const storage = 'storage' in navigator ? navigator.storage : undefined;
  try {
    if (await storage?.persisted?.()) return;
    await storage?.persist?.();
  } catch {
    // The app works without it, and Settings shows the status.
  }
}
