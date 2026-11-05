import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { listBodyweight, setBodyweight } from '../../src/data/bodyweight';
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
import { ionEvent, renderApp } from './helpers';

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
    expect(screen.queryByText('Start another day')).not.toBeInTheDocument();
  });

  it('shows the planned day with the week and starts it', async () => {
    const { ctx } = await withProgram();
    const { user } = renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Heavy (planche first)')).toBeInTheDocument();
    expect(screen.getByText('Week 1 of 6')).toBeInTheDocument();
    expect(screen.queryByText('Deload')).not.toBeInTheDocument();
    await user.click(screen.getByText('Start'));
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
    expect(screen.getByText('Next: Light (front lever first), 2026-11-04')).toBeInTheDocument();
    expect(screen.getByText('Start another day')).toBeInTheDocument();
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
    expect(screen.getByText('Next: Light (front lever first), 2026-11-04')).toBeInTheDocument();
    expect(screen.queryByText('Start')).not.toBeInTheDocument();
  });

  it('shows the next rotation day', async () => {
    const { ctx } = await withProgram(PROGRAM_A);
    renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Upper A')).toBeInTheDocument();
  });

  it('shows a Resume card instead while a workout is open', async () => {
    const { ctx } = await withProgram();
    await startEmptySession(ctx);
    const { user } = renderApp('/tabs/today', ctx);
    expect(await screen.findByText('Resume workout')).toBeInTheDocument();
    expect(screen.queryByText('Start')).not.toBeInTheDocument();
    expect(screen.queryByText('Start another day')).not.toBeInTheDocument();
    await user.click(screen.getByText('Resume workout'));
    await waitFor(() => expect(window.location.hash).toBe('#/tabs/today/workout'));
  });

  it('starts an empty workout', async () => {
    const { ctx, user } = renderApp('/tabs/today');
    await user.click(await screen.findByText('Empty workout'));
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.session.name).toBe('Empty workout'),
    );
  });

  it('starts another day from the list, Test included', async () => {
    const { ctx } = await withProgram(PROGRAM_C, 1);
    const { user } = renderApp('/tabs/today/pick-day', ctx);
    const [test] = await screen.findAllByText('Test');
    await user.click(test as HTMLElement);
    await waitFor(async () => expect((await getActiveSession(ctx))?.session.name).toBe('Test'));
  });

  it('saves today’s bodyweight and shows it', async () => {
    const { ctx } = await withProgram();
    await setBodyweight(ctx, '2026-11-01', 39);
    const { user } = renderApp('/tabs/today', ctx);
    ionEvent(await screen.findByLabelText('Bodyweight today'), 'ionInput', { value: '40,5' });
    await user.click(screen.getByText('Save weight'));
    await waitFor(async () =>
      expect((await listBodyweight(ctx)).at(-1)).toEqual({ date: '2026-11-02', kg: 40.5 }),
    );
    expect(await screen.findByText('Saved: 40.5kg')).toBeInTheDocument();
  });
});
