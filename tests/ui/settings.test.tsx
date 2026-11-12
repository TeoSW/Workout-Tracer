import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { version } from '../../package.json';
import { exportBackup, backupToJson, hasUndoSnapshot } from '../../src/data/backup';
import { listBands } from '../../src/data/bands';
import { setBodyweight, listBodyweight } from '../../src/data/bodyweight';
import { activateProgram, createProgramFromTemplate } from '../../src/data/programs';
import { seedIfNeeded } from '../../src/data/seed';
import { CALISTHENICS_5_WEEK } from '../../src/domain/fixtures/templates';
import { getSettings } from '../../src/data/settings';
import { testContext } from '../unit/data/helpers';
import { buttonLabelled, ionEvent, renderApp, selectLabelled } from './helpers';

vi.mock('../../src/pwa/files', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/pwa/files')>()),
  saveFile: vi.fn(async () => 'saved'),
}));

describe('settings', () => {
  it('changes the effort input and the toggles', async () => {
    const { ctx } = renderApp('/tabs/settings');
    await screen.findByText('Sound');
    ionEvent(selectLabelled('Effort input'), 'ionChange', { value: 'rpe' });
    await waitFor(async () => expect((await getSettings(ctx)).effortMode).toBe('rpe'));

    ionEvent(screen.getByLabelText('Sound'), 'ionChange', { checked: false });
    await waitFor(async () => expect((await getSettings(ctx)).sound).toBe(false));

    ionEvent(screen.getByLabelText('Keep screen awake'), 'ionChange', { checked: false });
    await waitFor(async () => expect((await getSettings(ctx)).keepAwake).toBe(false));
  });

  it('changes the backup reminder interval', async () => {
    const { ctx, user } = renderApp('/tabs/settings');
    await user.click(await buttonLabelled('More reminder days'));
    await waitFor(async () => expect((await getSettings(ctx)).backupReminderDays).toBe(15));
  });

  it('shows the app version', async () => {
    renderApp('/tabs/settings');
    expect(await screen.findByText('App version')).toBeInTheDocument();
    expect(screen.getByText(version)).toBeInTheDocument();
  });
});

describe('bands', () => {
  it('lists the bands by rated kg, adds and archives', async () => {
    const { ctx, user } = renderApp('/tabs/settings/bands');
    expect(await screen.findByText('35kg')).toBeInTheDocument();
    ionEvent(screen.getByLabelText('New band name'), 'ionInput', { value: 'Thin' });
    ionEvent(screen.getByLabelText('New band rated kg'), 'ionInput', { value: '3' });
    await user.click(screen.getByText('Add band'));
    expect(await screen.findByText('Thin')).toBeInTheDocument();
    await waitFor(async () => expect((await listBands(ctx))[0]?.label).toBe('Thin'));

    await user.click(await buttonLabelled('Archive 15kg'));
    await waitFor(async () => expect(await listBands(ctx)).toHaveLength(4));
    await waitFor(() => expect(screen.queryByText('15kg')).not.toBeInTheDocument());
  });

  it('shows an error for a band without a name', async () => {
    const { user } = renderApp('/tabs/settings/bands');
    await screen.findByText('35kg');
    ionEvent(screen.getByLabelText('New band rated kg'), 'ionInput', { value: '5' });
    await user.click(screen.getByText('Add band'));
    expect(await screen.findByText('Give the band a name and a rated kg.')).toBeInTheDocument();
  });
});

describe('backup', () => {
  it('exports a backup through the file helper and records the time', async () => {
    const { saveFile } = await import('../../src/pwa/files');
    const { ctx, user } = renderApp('/tabs/settings');
    await user.click(await screen.findByText('Export backup'));
    await waitFor(() => expect(saveFile).toHaveBeenCalled());
    expect(vi.mocked(saveFile).mock.calls[0]?.[0]).toBe('workout-tracker-backup-2026-11-02.json');
    await waitFor(async () => expect((await getSettings(ctx)).lastBackupAt).toBe(ctx.clock.now()));
    expect(await screen.findByText('Backup saved.')).toBeInTheDocument();
  });

  it('refuses a bad file and changes nothing', async () => {
    const { ctx, user } = renderApp('/tabs/settings');
    await screen.findByText('Export backup');
    const input = screen.getByLabelText('Backup file');
    await user.upload(input, new File(['not json'], 'x.json', { type: 'application/json' }));
    expect(await screen.findByText('This file is not valid JSON.')).toBeInTheDocument();
    expect(await hasUndoSnapshot(ctx)).toBeNull();
  });

  it('restores from a file after showing the counts, then undoes it', async () => {
    const source = testContext();
    await seedIfNeeded(source);
    await setBodyweight(source, '2026-10-01', 70);
    const json = backupToJson(await exportBackup(source));

    const { ctx, user } = renderApp('/tabs/settings');
    await screen.findByText('Export backup');
    await setBodyweight(ctx, '2026-11-02', 40);
    const input = screen.getByLabelText('Backup file');
    await user.upload(input, new File([json], 'b.json', { type: 'application/json' }));

    expect(
      await screen.findByText('60 exercises, 0 sessions, 1 bodyweight entries'),
    ).toBeInTheDocument();
    expect(await listBodyweight(ctx)).toEqual([{ date: '2026-11-02', kg: 40 }]);

    await user.click(screen.getByText('Replace all data'));
    await waitFor(async () =>
      expect(await listBodyweight(ctx)).toEqual([{ date: '2026-10-01', kg: 70 }]),
    );

    await user.click(await screen.findByText('Undo last restore'));
    await waitFor(async () =>
      expect(await listBodyweight(ctx)).toEqual([{ date: '2026-11-02', kg: 40 }]),
    );
    await waitFor(() => expect(screen.queryByText('Undo last restore')).not.toBeInTheDocument());
  });
});

describe('workout reminders', () => {
  it('hands Calendar a file of the training days, each with an alert', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const { program } = await createProgramFromTemplate(ctx, CALISTHENICS_5_WEEK);
    await activateProgram(ctx, program.id, 'this_week');
    const blobs: Blob[] = [];
    const create = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:calendar';
    });
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { user } = renderApp('/tabs/settings', ctx);
    await user.click(await screen.findByText('Add reminders to Calendar'));
    expect(
      await screen.findByText('32 training days. Tap Add All in Calendar.'),
    ).toBeInTheDocument();
    expect(blobs[0]?.type).toBe('text/calendar');
    const blob = blobs[0];
    if (!blob) throw new Error('no calendar file');
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(text).toContain('SUMMARY:Heavy 1\\, planche (intensity)');
    expect(text).toContain('TRIGGER:-PT60M');
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});
