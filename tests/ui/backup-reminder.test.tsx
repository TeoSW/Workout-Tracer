import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firstFinishedDate } from '../../src/data/history';
import { startEmptySession } from '../../src/data/sessions';
import { getSettings, setSetting } from '../../src/data/settings';
import { saveFile } from '../../src/pwa/files';
import { testContext } from '../unit/data/helpers';
import { logWorkout, renderApp } from './helpers';

vi.mock('../../src/pwa/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/pwa/files')>()),
  saveFile: vi.fn(async () => 'saved'),
}));

const DAY = 24 * 60 * 60 * 1000;
const TITLE = 'Back up your data';

/** A workout finished 20 days ago, with no backup since. */
async function overdue() {
  const ctx = testContext();
  await logWorkout(ctx, 'Old session');
  ctx.clock.advance(20 * DAY);
  return ctx;
}

describe('backup reminder', () => {
  beforeEach(() => vi.mocked(saveFile).mockClear());

  it('stays away on a fresh install', async () => {
    renderApp();
    await screen.findByText('Bodyweight');
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it('shows when due, and leaves once a backup is saved', async () => {
    const ctx = await overdue();
    const { user } = renderApp('/tabs/today', ctx);
    expect(await screen.findByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(/You have no backup yet/)).toBeInTheDocument();
    await user.click(screen.getByText('Export backup'));
    await waitFor(() => expect(screen.queryByText(TITLE)).not.toBeInTheDocument());
    expect(vi.mocked(saveFile)).toHaveBeenCalledOnce();
    expect((await getSettings(ctx)).lastBackupAt).toBe(ctx.clock.now());
  });

  it('stays when the share sheet is closed', async () => {
    vi.mocked(saveFile).mockResolvedValueOnce('cancelled');
    const ctx = await overdue();
    const { user } = renderApp('/tabs/today', ctx);
    await user.click(await screen.findByText('Export backup'));
    await waitFor(() => expect(saveFile).toHaveBeenCalledOnce());
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect((await getSettings(ctx)).lastBackupAt).toBeNull();
  });

  it('says when a save fails', async () => {
    vi.mocked(saveFile).mockRejectedValueOnce(new Error('No space left.'));
    const ctx = await overdue();
    const { user } = renderApp('/tabs/today', ctx);
    await user.click(await screen.findByText('Export backup'));
    expect(await screen.findByText('No space left.')).toBeInTheDocument();
  });

  it('names the last backup', async () => {
    const ctx = await overdue();
    await setSetting(ctx, 'lastBackupAt', ctx.clock.now() - 15 * DAY);
    renderApp('/tabs/today', ctx);
    expect(await screen.findByText(/Your last backup was on 7 Nov 2026/)).toBeInTheDocument();
  });

  it('hides during a workout', async () => {
    const ctx = await overdue();
    await startEmptySession(ctx);
    renderApp('/tabs/today', ctx);
    await screen.findByText('Current workout');
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
  });

  it('follows a changed interval', async () => {
    const ctx = await overdue();
    await setSetting(ctx, 'backupReminderDays', 30);
    renderApp('/tabs/today', ctx);
    await screen.findByText('Bodyweight');
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
    await setSetting(ctx, 'backupReminderDays', 10);
    expect(await screen.findByText(TITLE)).toBeInTheDocument();
  });
});

describe('first finished date', () => {
  it('skips active sessions and finds the earliest finished one', async () => {
    const ctx = testContext();
    expect(await firstFinishedDate(ctx)).toBeNull();
    await logWorkout(ctx, 'First');
    const first = ctx.clock.today();
    ctx.clock.advance(3 * DAY);
    await logWorkout(ctx, 'Second');
    await startEmptySession(ctx);
    expect(await firstFinishedDate(ctx)).toBe(first);
  });
});
