import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { listBodyweight, setBodyweight } from '../../src/data/bodyweight';
import { listMissedDays } from '../../src/data/missed-days';
import { activateProgram, createProgramFromTemplate } from '../../src/data/programs';
import { seedIfNeeded } from '../../src/data/seed';
import {
  finishSession,
  getActiveSession,
  startEmptySession,
  startPlannedSession,
} from '../../src/data/sessions';
import { PROGRAM_A, PROGRAM_C } from '../../src/domain/fixtures/templates';
import type { DayTemplate } from '../../src/domain/schemas';
import { START_MS, testClock, testContext } from '../unit/data/helpers';
import { confirmAlert, ionEvent, renderApp } from './helpers';

const DAY = 86_400_000;

// The clock starts on Monday 2026-11-02, and programs start that week.
async function withProgram(template = PROGRAM_C, offsetDays = 0) {
  const ctx = testContext({ clock: testClock(START_MS + offsetDays * DAY) });
  await seedIfNeeded(ctx);
  const { program, dayTemplates } = await createProgramFromTemplate(ctx, template);
  await activateProgram(ctx, program.id, 'this_week');
  const day = (name: string) => dayTemplates.find((d) => d.name === name) as DayTemplate;
  return { ctx, program, day };
}

describe('Today', () => {
  it('offers to pick a program when none is active', async () => {
    renderApp('/tabs/today');
    expect(await screen.findByText('Pick a program')).toBeInTheDocument();
    expect(screen.getByText('Empty workout')).toBeInTheDocument();
    expect(screen.queryByText('Start workout')).not.toBeInTheDocument();
  });

  it('shows the planned day with the week and starts it from the preview', async () => {
    const { ctx } = await withProgram();
    const { user } = renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Heavy (planche first)')).toBeInTheDocument();
    expect(screen.getByText('Week 1 of 6')).toBeInTheDocument();
    expect(screen.queryByText('Deload')).not.toBeInTheDocument();
    await user.click(screen.getByText('Start workout'));
    await waitFor(() => expect(window.location.hash).toBe('#/tabs/today/start'));
    const preview = within(await screen.findByTestId('start-preview'));
    expect(await preview.findByText('Planche Complex')).toBeInTheDocument();
    await user.click(screen.getAllByText('Start workout').at(-1) as HTMLElement);
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.session.name).toBe('Heavy (planche first)'),
    );
    await waitFor(() => expect(window.location.hash).toBe('#/tabs/today/workout'));
  });

  it('shows the Deload badge in a deload week', async () => {
    const { ctx } = await withProgram(PROGRAM_C, 0);
    ctx.clock.set(START_MS + 35 * DAY); // week 6 Monday
    renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Week 6 of 6')).toBeInTheDocument();
    expect(await screen.findByText('Deload')).toBeInTheDocument();
  });

  it('has no Deload badge on a day exempt from it', async () => {
    const { ctx } = await withProgram(PROGRAM_C, 0);
    ctx.clock.set(START_MS + 41 * DAY); // week 6 Sunday, Legs
    renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Legs')).toBeInTheDocument();
    expect(screen.queryByText('Deload')).not.toBeInTheDocument();
  });

  it('says so on a rest day and still offers the other starts', async () => {
    const { ctx } = await withProgram(PROGRAM_C, 1); // Tuesday
    renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Rest day')).toBeInTheDocument();
    expect(screen.getByText('Next: Light (front lever first), Wed 4 Nov')).toBeInTheDocument();
    expect(screen.getByText('Start workout')).toBeInTheDocument();
    expect(screen.getByText('Empty workout')).toBeInTheDocument();
  });

  it('shows a finished day as done with the next day', async () => {
    const { ctx, program, day } = await withProgram();
    const started = await startPlannedSession(ctx, {
      programId: program.id,
      dayTemplateId: day('Heavy (planche first)').id,
    });
    await finishSession(ctx, started.session.id);
    renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Done: Heavy (planche first)')).toBeInTheDocument();
    expect(screen.getByText('Next: Light (front lever first), Wed 4 Nov')).toBeInTheDocument();
    expect(screen.queryByText('Training today?')).not.toBeInTheDocument();
  });

  it('shows the next rotation day', async () => {
    const { ctx } = await withProgram(PROGRAM_A);
    renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Upper A')).toBeInTheDocument();
  });

  it('shows the current workout with its exercises while one is open', async () => {
    const { ctx, program, day } = await withProgram();
    await startPlannedSession(ctx, {
      programId: program.id,
      dayTemplateId: day('Heavy (planche first)').id,
    });
    const { user } = renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Current workout')).toBeInTheDocument();
    expect(await screen.findByText('Planche Complex')).toBeInTheDocument();
    expect(screen.getAllByText('0/3').length).toBeGreaterThan(0);
    expect(screen.queryByText('Start workout')).not.toBeInTheDocument();
    await user.click(screen.getByText('Continue workout'));
    await waitFor(() => expect(window.location.hash).toBe('#/tabs/today/workout'));
  });

  it('ends the current workout from Today after asking', async () => {
    const { ctx } = await withProgram();
    const { session } = await startEmptySession(ctx);
    const { user } = renderApp('/tabs/today', ctx);
    await user.click(await screen.findByText('End workout'));
    await confirmAlert(user, 'End workout');
    await waitFor(() => expect(window.location.hash).toBe(`#/tabs/today/summary/${session.id}`));
    expect(await getActiveSession(ctx)).toBeNull();
  });

  it('starts an empty workout', async () => {
    const { ctx, user } = renderApp('/tabs/today');
    await user.click(await screen.findByText('Empty workout'));
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.session.name).toBe('Empty workout'),
    );
  });

  it('starts any day from the preview, Test included', async () => {
    const { ctx } = await withProgram(PROGRAM_C, 1);
    const { user } = renderApp('/tabs/today/start', ctx);
    const days = within(await screen.findByTestId('start-days'));
    await user.click(await days.findByText('Test'));
    await user.click(screen.getAllByText('Start workout').at(-1) as HTMLElement);
    await waitFor(async () => expect((await getActiveSession(ctx))?.session.name).toBe('Test'));
  });

  it('trains a day as another week, with that week deloaded', async () => {
    const { ctx } = await withProgram(PROGRAM_C, 0);
    const { user } = renderApp('/tabs/today/start', ctx);
    await user.click(await screen.findByText('Week 6'));
    expect(await screen.findByText('Half the sets this week.')).toBeInTheDocument();
    await user.click(screen.getAllByText('Start workout').at(-1) as HTMLElement);
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.session).toMatchObject({
        name: 'Heavy (planche first)',
        cycleWeek: 6,
        isDeload: true,
      }),
    );
  });

  it('saves today’s bodyweight and shows it', async () => {
    const { ctx } = await withProgram();
    await setBodyweight(ctx, '2026-11-01', 39);
    const { user } = renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Add today')).toBeInTheDocument();
    await user.click(screen.getByText('Bodyweight'));
    ionEvent(await screen.findByLabelText('Bodyweight today'), 'ionInput', { value: '40,5' });
    await user.click(screen.getByText('Save weight'));
    await waitFor(async () =>
      expect((await listBodyweight(ctx)).at(-1)).toEqual({ date: '2026-11-02', kg: 40.5 }),
    );
    expect(await screen.findByText('40.5kg')).toBeInTheDocument();
  });
});

describe('Not today', () => {
  it('asks first, then skips the day with a reason and shows the next one', async () => {
    const { ctx } = await withProgram();
    const { user } = renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Training today?')).toBeInTheDocument();
    await user.click(screen.getByText('Not today'));
    await user.click(await screen.findByText('Sick'));
    ionEvent(screen.getByLabelText('Note'), 'ionInput', { value: 'Fever' });
    await user.click(screen.getByText('Skip day'));

    expect(await screen.findByText('Missed: Heavy (planche first)')).toBeInTheDocument();
    expect(screen.getByText('Sick, Fever')).toBeInTheDocument();
    expect(screen.getByText('Next: Light (front lever first), Wed 4 Nov')).toBeInTheDocument();
    expect(screen.queryByText('Training today?')).not.toBeInTheDocument();
    expect(await listMissedDays(ctx)).toMatchObject([{ reason: 'sick', note: 'Fever' }]);
  });

  it('can be undone from Today', async () => {
    const { ctx } = await withProgram();
    const { user } = renderApp('/tabs/today', ctx);
    await user.click(await screen.findByText('Not today'));
    await user.click(await screen.findByText('Skip day'));
    await user.click(await screen.findByText('Undo'));
    expect(await screen.findByText('Training today?')).toBeInTheDocument();
    expect(await listMissedDays(ctx)).toEqual([]);
  });

  it('is not offered on a rest day or once the day is done', async () => {
    const { ctx } = await withProgram(PROGRAM_C, 1);
    renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Rest day')).toBeInTheDocument();
    expect(screen.queryByText('Not today')).not.toBeInTheDocument();
  });
});

describe('Today across midnight', () => {
  it('moves on to the new day when the app comes back', async () => {
    const { ctx } = await withProgram(PROGRAM_C, 0);
    renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Heavy (planche first)')).toBeInTheDocument();
    ctx.clock.advance(DAY);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(await screen.findByText('Rest day')).toBeInTheDocument();
  });
});
