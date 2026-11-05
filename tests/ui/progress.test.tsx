import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createProgramFromTemplate, activateProgram } from '../../src/data/programs';
import { addExercise, finishSession, startEmptySession } from '../../src/data/sessions';
import { setSetting } from '../../src/data/settings';
import { PROGRAM_A } from '../../src/domain/fixtures/templates';
import { testContext } from '../unit/data/helpers';
import { buttonLabelled, ionEvent, logWorkout, renderApp } from './helpers';

const DAY = 86_400_000;

async function logWorkoutAfter(ctx: ReturnType<typeof testContext>, sessionId: string) {
  ctx.clock.advance(3_600_000);
  await finishSession(ctx, sessionId);
}

describe('progress overview', () => {
  it('loads its lazy section and shows the empty state', async () => {
    renderApp('/tabs/progress');
    expect(
      await screen.findByText('Stats will show here once you log workouts.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Bodyweight')).toBeInTheDocument();
    expect(screen.queryByText('Consistency')).not.toBeInTheDocument();
  });

  it('shows streak, this week against the plan, and average duration', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'First');
    const { program } = await createProgramFromTemplate(ctx, PROGRAM_A);
    await activateProgram(ctx, program.id, 'this_week');
    renderApp('/tabs/progress', ctx);
    expect(
      await screen.findByText('1 week streak, this week 1 of 3, average 1h 00m'),
    ).toBeInTheDocument();
  });

  it('says only what was finished without an active program', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'First');
    renderApp('/tabs/progress', ctx);
    expect(await screen.findByText('1 week streak, this week 1, average 1h 00m')).toBeTruthy();
  });

  it('counts muscles in the band, and steps through weeks up to this one', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'First');
    const { user } = renderApp('/tabs/progress', ctx);

    expect(await screen.findByText('Week of 2 Nov')).toBeInTheDocument();
    expect(screen.getByText('0 of 18 muscles at 10-20 sets')).toBeInTheDocument();
    expect(await buttonLabelled('Next week')).toHaveAttribute('disabled');

    await user.click(await buttonLabelled('Previous week'));
    expect(await screen.findByText('Week of 26 Oct')).toBeInTheDocument();
    await waitFor(async () =>
      expect(await buttonLabelled('Next week')).not.toHaveAttribute('disabled'),
    );
  });

  it('averages the last four full weeks', async () => {
    const ctx = testContext();
    for (let i = 0; i < 10; i += 1) await logWorkout(ctx, 'Squats');
    await setSetting(ctx, 'muscleReference', { min: 2, max: 20 });
    renderApp('/tabs/progress', ctx);
    expect(await screen.findByText('3 of 18 muscles at 2-20 sets')).toBeInTheDocument();

    // This week isn't over, so it stays out of the average.
    const toggle = document.querySelector('ion-toggle') as Element;
    ionEvent(toggle, 'ionChange', { checked: true });
    expect(await screen.findByText('0 of 18 muscles at 2-20 sets')).toBeInTheDocument();
  });

  it('rests while hidden, and catches up on return', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'First');
    const { user } = renderApp('/tabs/progress', ctx);
    await screen.findByText('1 week streak, this week 1, average 1h 00m');

    await user.click(screen.getByText('Today'));
    await waitFor(() => expect(window.location.hash).toBe('#/tabs/today'));
    await screen.findByText('Resume workout').catch(() => undefined);
    const reads = vi.spyOn(ctx.db.sets, 'toArray');
    const { session } = await startEmptySession(ctx);
    await addExercise(ctx, session.id, 'squat');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(reads).not.toHaveBeenCalled();

    await logWorkoutAfter(ctx, session.id);
    await user.click(document.querySelector('ion-tab-button[tab="progress"]') as Element);
    expect(
      await screen.findByText('1 week streak, this week 2, average 1h 00m'),
    ).toBeInTheDocument();
  });

  it('lists recent PRs and opens the session', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'First', 'hypertrophy', 20);
    ctx.clock.advance(DAY);
    const { sessionId } = await logWorkout(ctx, 'Second', 'hypertrophy', 25);
    const { user } = renderApp('/tabs/progress', ctx);

    await user.click(await screen.findByText('Squat: heaviest load 25kg'));
    await waitFor(() => expect(window.location.hash).toBe(`#/tabs/history/${sessionId}`));
  });
});
