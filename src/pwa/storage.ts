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
