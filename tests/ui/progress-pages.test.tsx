import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setBodyweight } from '../../src/data/bodyweight';
import { seedIfNeeded } from '../../src/data/seed';
import {
  addExercise,
  addSet,
  finishSession,
  startEmptySession,
  updateSet,
} from '../../src/data/sessions';
import type { LoggedSet } from '../../src/domain/schemas';
import { testContext } from '../unit/data/helpers';
import { ionEvent, logWorkout, renderApp } from './helpers';

const DAY = 86_400_000;
type Ctx = ReturnType<typeof testContext>;

/** Finishes a workout with one exercise, its sets logged with these values. */
async function logExercise(ctx: Ctx, exerciseId: string, values: Partial<LoggedSet>[]) {
  await seedIfNeeded(ctx);
  const { session } = await startEmptySession(ctx);
  const entry = await addExercise(ctx, session.id, exerciseId);
  const ids = entry.sets.map((s) => s.id);
  while (ids.length < values.length) ids.push((await addSet(ctx, entry.id)).id);
  for (const [i, value] of values.entries()) {
    await updateSet(ctx, ids[i] as string, { ...value, done: true });
  }
  ctx.clock.advance(3_600_000);
  await finishSession(ctx, session.id);
  ctx.clock.advance(DAY);
  return session.id;
}

const hold = (seconds: number): Partial<LoggedSet> => ({
  seconds,
  clean: true,
  progressionLevel: 'Tuck',
});

describe('bodyweight page', () => {
  it('adds an entry for a past day and shows the average', async () => {
    const ctx = testContext();
    await setBodyweight(ctx, '2026-11-02', 70);
    const { user } = renderApp('/tabs/progress/bodyweight', ctx);
    expect(await screen.findByText('Latest 70kg, 7-day average 70kg')).toBeInTheDocument();

    ionEvent(await screen.findByLabelText('Date'), 'ionInput', { value: '2026-11-01' });
    ionEvent(await screen.findByLabelText('Weight'), 'ionInput', { value: '71,5' });
    await user.click(await screen.findByText('Save'));
    expect(await screen.findByText('Sunday 1 November')).toBeInTheDocument();
    expect(await ctx.db.bodyweight.get('2026-11-01')).toEqual({ date: '2026-11-01', kg: 71.5 });
    expect(await screen.findByText('Latest 70kg, 7-day average 70.75kg')).toBeInTheDocument();
  });

  it('replaces an entry saved again for the same day', async () => {
    const ctx = testContext();
    await setBodyweight(ctx, '2026-11-02', 70);
    const { user } = renderApp('/tabs/progress/bodyweight', ctx);

    await user.click(await screen.findByText('Monday 2 November'));
    ionEvent(await screen.findByLabelText('Weight'), 'ionInput', { value: '69' });
    await user.click(await screen.findByText('Save'));
    await waitFor(async () =>
      expect(await ctx.db.bodyweight.toArray()).toEqual([{ date: '2026-11-02', kg: 69 }]),
    );
  });

  it('deletes an entry', async () => {
    const ctx = testContext();
    await setBodyweight(ctx, '2026-11-02', 70);
    const { user } = renderApp('/tabs/progress/bodyweight', ctx);
    await screen.findByText('Monday 2 November');
    await user.click(screen.getByText('Delete'));
    await waitFor(async () => expect(await ctx.db.bodyweight.count()).toBe(0));
    await waitFor(() => expect(screen.queryByText('Monday 2 November')).toBeNull());
  });

  it('explains a bad weight and a future date', async () => {
    const ctx = testContext();
    const { user } = renderApp('/tabs/progress/bodyweight', ctx);
    await user.click(await screen.findByText('Save'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your weight in kg.');

    ionEvent(await screen.findByLabelText('Weight'), 'ionInput', { value: '70' });
    ionEvent(await screen.findByLabelText('Date'), 'ionInput', { value: '2026-12-01' });
    await user.click(await screen.findByText('Save'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Pick a date up to today.'),
    );
    expect(await ctx.db.bodyweight.count()).toBe(0);
  });
});

describe('skills page', () => {
  it('says what will show before anything is logged', async () => {
    renderApp('/tabs/progress/skills');
    expect(
      await screen.findByText('Holds and complexes will show here once you log them.'),
    ).toBeInTheDocument();
  });

  it('shows holds, complexes and test results, newest first', async () => {
    const ctx = testContext();
    const sessionId = await logExercise(ctx, 'planche-hold', [hold(8), hold(12)]);
    await logExercise(ctx, 'planche-complex', [{ bandIds: ['band-15'], clean: true }]);
    await ctx.db.testResults.bulkAdd([
      {
        id: 'older',
        sessionId,
        date: '2026-10-01',
        exerciseId: 'planche-hold',
        progressionLevel: 'Tuck',
        bestHoldSec: 9,
        note: '',
        nextCycleChoice: null,
      },
      {
        id: 'newer',
        sessionId,
        date: '2026-11-02',
        exerciseId: 'planche-hold',
        progressionLevel: 'Tuck',
        bestHoldSec: 12,
        note: 'Hips high.',
        nextCycleChoice: null,
      },
    ]);
    renderApp('/tabs/progress/skills', ctx);

    expect(await screen.findByText('Best: Tuck 12s')).toBeInTheDocument();
    expect(screen.getByText('Band level')).toBeInTheDocument();
    expect(screen.getByText('Lower is harder.')).toBeInTheDocument();
    expect(screen.getByText('Clean sets')).toBeInTheDocument();
    const lines = screen.getAllByText(/^\d+ \w+ · Tuck · \d+s$/).map((el) => el.textContent);
    expect(lines).toEqual(['2 Nov · Tuck · 12s', '1 Oct · Tuck · 9s']);
    expect(screen.getByText('Hips high.')).toBeInTheDocument();
  });
});

describe('exercise pages', () => {
  it('lists only exercises with logged sets', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'First');
    const { user } = renderApp('/tabs/progress/exercises', ctx);

    await user.click(await screen.findByRole('heading', { name: 'Squat' }));
    await waitFor(() => expect(window.location.hash).toBe('#/tabs/progress/exercises/squat'));
    expect(await screen.findByText('Set history')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bench Press' })).toBeNull();
  });

  it('says when nothing is logged yet', async () => {
    renderApp('/tabs/progress/exercises');
    expect(await screen.findByText('Exercises will show here once you log them.')).toBeTruthy();
  });

  it('shows records, the charts for the type, and every set', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'First', 'hypertrophy', 20);
    ctx.clock.advance(DAY);
    await logWorkout(ctx, 'Second', 'hypertrophy', 25);
    renderApp('/tabs/programs/library/squat', ctx);

    expect(await screen.findByText('Heaviest load 25kg')).toBeInTheDocument();
    expect(screen.getByText('e1RM trend')).toBeInTheDocument();
    expect(screen.getByText('Heaviest load')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3 Nov 2026 · Second' })).toBeInTheDocument();
    expect(screen.getByText(/^Set 1 · 20kg x 5/)).toBeInTheDocument();
  });

  it('pages through a long history', async () => {
    const ctx = testContext();
    for (let i = 0; i < 21; i += 1) {
      await logWorkout(ctx, `Workout ${i + 1}`);
      ctx.clock.advance(DAY);
    }
    const { user } = renderApp('/tabs/programs/library/squat', ctx);
    await screen.findByText('Set history');
    expect(screen.queryByRole('heading', { name: /Workout 1$/ })).toBeNull();

    await user.click(screen.getByText('Show more'));
    expect(await screen.findByRole('heading', { name: /Workout 1$/ })).toBeInTheDocument();
    expect(screen.queryByText('Show more')).toBeNull();
  });

  it('says so when an exercise has no logs', async () => {
    renderApp('/tabs/programs/library/squat');
    expect(await screen.findByText('No sets logged yet.')).toBeInTheDocument();
    expect(screen.queryByText('Set history')).toBeNull();
  });
});
