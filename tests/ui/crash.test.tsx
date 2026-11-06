import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy, Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrashScreen } from '../../src/app/CrashScreen';
import { DataProvider } from '../../src/app/DataProvider';
import { ErrorBoundary } from '../../src/app/ErrorBoundary';
import { seedIfNeeded } from '../../src/data/seed';
import { getSettings } from '../../src/data/settings';
import { parseBackup } from '../../src/domain/backup';
import { saveFile } from '../../src/pwa/files';
import { reloadApp } from '../../src/pwa/reload';
import { testContext } from '../unit/data/helpers';

vi.mock('../../src/pwa/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/pwa/files')>()),
  saveFile: vi.fn(async () => 'saved'),
}));
vi.mock('../../src/pwa/reload', () => ({ reloadApp: vi.fn() }));

function Bomb(): never {
  throw new Error('A screen broke');
}

describe('crash screen', () => {
  beforeEach(() => {
    vi.mocked(saveFile).mockClear();
    vi.mocked(reloadApp).mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.mocked(console.error).mockRestore();
  });

  it('replaces a screen that throws, and leaves a healthy one alone', async () => {
    const ctx = testContext();
    const { unmount } = render(<ErrorBoundary ctx={ctx}>Fine</ErrorBoundary>);
    expect(screen.getByText('Fine')).toBeInTheDocument();
    unmount();
    render(
      <ErrorBoundary ctx={ctx}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('catches a chunk that fails to load', async () => {
    const Broken = lazy(() => Promise.reject(new Error('Failed to fetch')));
    render(
      <ErrorBoundary ctx={testContext()}>
        <Suspense fallback="Loading">
          <Broken />
        </Suspense>
      </ErrorBoundary>,
    );
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('exports a backup that can be restored and notes the time', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    render(<CrashScreen ctx={ctx} />);
    await userEvent.click(screen.getByText('Export my data'));
    expect(await screen.findByText('Backup saved.')).toBeInTheDocument();
    const [name, json] = vi.mocked(saveFile).mock.calls[0] ?? [];
    expect(name).toMatch(/^workout-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(parseBackup(JSON.parse(json ?? '')).ok).toBe(true);
    expect((await getSettings(ctx)).lastBackupAt).toBe(ctx.clock.now());
  });

  it('says nothing when the share sheet is closed', async () => {
    vi.mocked(saveFile).mockResolvedValueOnce('cancelled');
    const ctx = testContext();
    await seedIfNeeded(ctx);
    render(<CrashScreen ctx={ctx} />);
    await userEvent.click(screen.getByText('Export my data'));
    await waitFor(() => expect(screen.getByText('Export my data')).toBeEnabled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect((await getSettings(ctx)).lastBackupAt).toBeNull();
  });

  it('says so when the export fails', async () => {
    vi.mocked(saveFile).mockRejectedValueOnce(new Error('No space'));
    const ctx = testContext();
    await seedIfNeeded(ctx);
    render(<CrashScreen ctx={ctx} />);
    await userEvent.click(screen.getByText('Export my data'));
    expect(await screen.findByText('The export failed. Reload and try again.')).toBeInTheDocument();
  });

  it('reloads', async () => {
    render(<CrashScreen ctx={testContext()} />);
    await userEvent.click(screen.getByText('Reload'));
    expect(reloadApp).toHaveBeenCalledOnce();
  });

  it('shows when the data will not open', async () => {
    const ctx = testContext();
    const settingsGet = vi.spyOn(ctx.db.settings, 'get').mockRejectedValue(new Error('Blocked'));
    render(<DataProvider ctx={ctx}>Fine</DataProvider>);
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    settingsGet.mockRestore();
  });
});
