import { useState } from 'react';
import type { DataContext } from '../data/context';
import { saveBackup } from '../features/settings/saveBackup';
import { reloadApp } from '../pwa/reload';
import type { AppUpdate } from '../pwa/useAppUpdate';

/**
 * Shown when the app can't go on. It is plain HTML, since the crash may be in Ionic or the shell,
 * and it reaches the data through ctx, so it works without any provider above it.
 */
export function CrashScreen({ ctx, update }: { ctx: DataContext; update: AppUpdate }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function exportData() {
    setSaving(true);
    try {
      if ((await saveBackup(ctx)) === 'saved') setMessage('Backup saved.');
    } catch {
      setMessage('The export failed. Reload and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="crash-screen">
      <h1>Something went wrong</h1>
      <p>Your logs are still on this device. Export them, then reload.</p>
      <button type="button" disabled={saving} onClick={() => void exportData()}>
        Export my data
      </button>
      {/* A plain reload stays on the old version, so a fix for this crash has to be applied. */}
      <button type="button" onClick={update.waiting ? update.apply : reloadApp}>
        Reload
      </button>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
