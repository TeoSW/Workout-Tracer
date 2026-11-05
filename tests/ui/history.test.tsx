import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seedIfNeeded } from '../../src/data/seed';
import {
  addExercise,
  finishSession,
  startEmptySession,
  updateSession,
  updateSet,
} from '../../src/data/sessions';
import type { DayType } from '../../src/domain/schemas';
import { testContext } from '../unit/data/helpers';
import { buttonLabelled, renderApp } from './helpers';

const DAY = 86_400_000;
type Ctx = ReturnType<typeof testContext>;

/** Finishes a workout today with one set of squats. */
async function logWorkout(ctx: Ctx, name: string, dayType: DayType = 'hypertrophy', kg = 20) {
  await seedIfNeeded(ctx);
  const { session } = await startEmptySession(ctx);
  const entry = await addExercise(ctx, session.id, 'squat');
  const set = entry.sets[0];
  if (!set) throw new Error('No set');
  await updateSet(ctx, set.id, { kg, reps: 5, rir: 0, done: true });
  await ctx.db.sessions.update(session.id, { dayType });
  await updateSession(ctx, session.id, { name });
  ctx.clock.advance(3_600_000);
  await finishSession(ctx, session.id);
  return { sessionId: session.id, setId: set.id };
}

describe('history calendar', () => {
  it('marks days by day type and names them for screen readers', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'Heavy', 'skill_heavy');
    ctx.clock.advance(DAY);
    await logWorkout(ctx, 'Legs', 'hypertrophy');
    renderApp('/tabs/history', ctx);

    const heavy = await screen.findByRole('button', { name: 'Monday 2 November, Heavy' });
    expect(heavy.querySelector('[data-day-type="skill_heavy"]')).not.toBeNull();
    const legs = screen.getByRole('button', { name: 'Tuesday 3 November, Legs' });
    expect(legs.querySelector('[data-day-type="hypertrophy"]')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument();
    expect(screen.getByText('Skill heavy')).toBeInTheDocument();
    expect(screen.getByText('Hypertrophy')).toBeInTheDocument();
    expect(screen.getByText('2 Nov · Skill heavy · 1h 00m')).toBeInTheDocument();
  });

  it('shows two sessions on one day, and leaves out a running workout', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'Morning', 'strength');
    await logWorkout(ctx, 'Evening', 'conditioning');
    await startEmptySession(ctx);
    renderApp('/tabs/history', ctx);

    const day = await screen.findByRole('button', {
      name: 'Monday 2 November, Morning, Evening',
    });
    expect(day.querySelectorAll('.calendar-bar')).toHaveLength(2);
    expect(screen.queryByText('Workout')).not.toBeInTheDocument();
  });

  it('filters the list by day, and clears the filter', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'First');
    ctx.clock.advance(DAY);
    await logWorkout(ctx, 'Second');
    const { user } = renderApp('/tabs/history', ctx);

    await user.click(await screen.findByRole('button', { name: /Monday 2 November/ }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Second' })).toBeNull());
    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument();

    await user.click(screen.getByText('Show all of November 2026'));
    expect(await screen.findByRole('heading', { name: 'Second' })).toBeInTheDocument();
  });

  it('steps through months, stops at this month, and says when one is empty', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'First');
    const { user } = renderApp('/tabs/history', ctx);
    await screen.findByRole('heading', { name: 'First' });

    const next = await buttonLabelled('Next month');
    expect(next).toHaveAttribute('disabled');
    await user.click(await buttonLabelled('Previous month'));
    expect(await screen.findByRole('heading', { name: 'October 2026' })).toBeInTheDocument();
    expect(await screen.findByText('No workouts this month.')).toBeInTheDocument();
    const calendar = document.querySelector('.calendar') as HTMLElement;
    expect(within(calendar).queryByRole('button', { name: /November/ })).toBeNull();
  });
});
