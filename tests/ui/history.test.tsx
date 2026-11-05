import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getRestTimer } from '../../src/data/rest-timer';
import {
  addSet,
  deleteSession,
  getSessionView,
  sessionPrs,
  startEmptySession,
} from '../../src/data/sessions';
import { testContext } from '../unit/data/helpers';
import { buttonLabelled, confirmAlert, ionEvent, logWorkout, renderApp } from './helpers';

const DAY = 86_400_000;

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

    await user.click(await screen.findByRole('button', { name: 'Monday 2 November, First' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Second' })).toBeNull());
    expect(screen.getByRole('heading', { name: 'First' })).toBeInTheDocument();

    await user.click(screen.getByText('Show all of November 2026'));
    expect(await screen.findByRole('heading', { name: 'Second' })).toBeInTheDocument();
  });

  it('lets go of a picked day when its only workout is deleted', async () => {
    const ctx = testContext();
    const { sessionId } = await logWorkout(ctx, 'First');
    ctx.clock.advance(DAY);
    await logWorkout(ctx, 'Second');
    const { user } = renderApp('/tabs/history', ctx);

    await user.click(await screen.findByRole('button', { name: 'Monday 2 November, First' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Second' })).toBeNull());
    await deleteSession(ctx, sessionId);
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

describe('session view', () => {
  it('shows what was logged, with PR flags, and hides sets never logged', async () => {
    const ctx = testContext();
    await logWorkout(ctx, 'First', 'hypertrophy', 20);
    ctx.clock.advance(DAY);
    const { sessionId, setId } = await logWorkout(ctx, 'Second', 'hypertrophy', 25);
    const set = await ctx.db.sets.get(setId);
    await addSet(ctx, set?.sessionExerciseId ?? '');
    renderApp(`/tabs/history/${sessionId}`, ctx);

    expect(await screen.findByText(/^Set 1 · 25kg x 5/)).toBeInTheDocument();
    expect(screen.queryByText(/^Set 2/)).not.toBeInTheDocument();
    expect(screen.getByText('PR')).toBeInTheDocument();
    expect(screen.getByText('Squat: heaviest load 25kg')).toBeInTheDocument();
    expect(screen.getByText('Tuesday 3 November')).toBeInTheDocument();
    expect(screen.getByText('1h 00m')).toBeInTheDocument();
  });

  it('shows the note from the plan', async () => {
    const ctx = testContext();
    const { sessionId } = await logWorkout(ctx, 'First');
    const session = await ctx.db.sessions.get(sessionId);
    await ctx.db.sessions.update(sessionId, {
      planSnapshot: {
        dayTemplateId: null,
        name: 'First',
        dayType: session?.dayType ?? 'custom',
        note: 'Keep rests strict.',
        isDeload: false,
        cycleNumber: null,
        cycleWeek: null,
        blocks: [],
      },
    });
    renderApp(`/tabs/history/${sessionId}`, ctx);
    expect(await screen.findByText('Keep rests strict.')).toBeInTheDocument();
  });

  it('asks before deleting, then removes the workout', async () => {
    const ctx = testContext();
    const { sessionId } = await logWorkout(ctx, 'First');
    const { user } = renderApp(`/tabs/history/${sessionId}`, ctx);

    await user.click(await screen.findByText('Delete workout'));
    await confirmAlert(user, 'Cancel');
    expect(await ctx.db.sessions.get(sessionId)).toBeDefined();

    await user.click(await screen.findByText('Delete workout'));
    await confirmAlert(user, 'Delete');
    await waitFor(async () => expect(await ctx.db.sessions.get(sessionId)).toBeUndefined());
    expect(await ctx.db.sets.where('sessionId').equals(sessionId).count()).toBe(0);
  });
});

describe('session edit', () => {
  async function openEditor() {
    const ctx = testContext();
    const first = await logWorkout(ctx, 'First', 'hypertrophy', 20);
    ctx.clock.advance(DAY);
    const second = await logWorkout(ctx, 'Second', 'hypertrophy', 25);
    const app = renderApp(`/tabs/history/${first.sessionId}/edit`, ctx);
    await screen.findByText(/^Set 1 · 20kg x 5/);
    return { ...app, ctx, first, second };
  }

  it('changes a logged value, and the PRs follow, with no rest timer', async () => {
    const { ctx, user, first, second } = await openEditor();
    await user.click(screen.getByText(/^Set 1 · 20kg x 5/));
    ionEvent(await screen.findByLabelText('Kg'), 'ionInput', { value: '30' });
    await user.click(await screen.findByTestId('sheet-done'));

    await waitFor(async () => expect((await ctx.db.sets.get(first.setId))?.kg).toBe(30));
    expect(await getRestTimer(ctx)).toBeUndefined();
    const later = await getSessionView(ctx, second.sessionId);
    expect(later?.exercises[0]?.sets[0]?.kg).toBe(25);
    expect(await sessionPrs(ctx, second.sessionId)).toEqual([]);
  });

  it('saves the name, notes and duration', async () => {
    const { ctx, first } = await openEditor();
    const [name, duration] = [...document.querySelectorAll('ion-input')];
    ionEvent(name as Element, 'ionChange', { value: 'Renamed' });
    ionEvent(duration as Element, 'ionChange', { value: '45' });
    ionEvent(document.querySelector('ion-textarea') as Element, 'ionChange', { value: 'Felt ok' });
    await waitFor(async () => {
      const session = await ctx.db.sessions.get(first.sessionId);
      expect(session).toMatchObject({ name: 'Renamed', notes: 'Felt ok' });
      expect((session?.finishedAt ?? 0) - (session?.startedAt ?? 0)).toBe(45 * 60_000);
    });
  });

  it('keeps a name on the workout', async () => {
    const { ctx, first } = await openEditor();
    const name = document.querySelector('ion-input') as Element;
    ionEvent(name, 'ionChange', { value: '   ' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Give this workout a name.');
    expect((await ctx.db.sessions.get(first.sessionId))?.name).toBe('First');
  });

  it('asks before removing an exercise', async () => {
    const { ctx, first } = await openEditor();
    // Overlays keep pointer-events off while they animate, which never ends in jsdom.
    const tap = userEvent.setup({ pointerEventsCheck: 0 });
    await tap.click(await buttonLabelled('Options for Squat'));
    await tap.click(await screen.findByText('Remove'));
    await confirmAlert(tap, 'Cancel');
    expect(await ctx.db.sets.where('sessionId').equals(first.sessionId).count()).toBe(1);

    await tap.click(await buttonLabelled('Options for Squat'));
    await tap.click((await screen.findAllByText('Remove')).at(-1) as Element);
    await confirmAlert(tap, 'Remove');
    await waitFor(async () =>
      expect(await ctx.db.sets.where('sessionId').equals(first.sessionId).count()).toBe(0),
    );
  });

  it('explains a bad duration', async () => {
    await openEditor();
    const duration = [...document.querySelectorAll('ion-input')][1] as Element;
    ionEvent(duration, 'ionChange', { value: '0' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A workout lasts at least one minute.',
    );
  });

  it('fills in a set that was never logged', async () => {
    const ctx = testContext();
    const { sessionId, setId } = await logWorkout(ctx, 'First');
    const set = await ctx.db.sets.get(setId);
    await addSet(ctx, set?.sessionExerciseId ?? '');
    const { user } = renderApp(`/tabs/history/${sessionId}/edit`, ctx);

    await user.click(await screen.findByText('Set 2'));
    ionEvent(await screen.findByLabelText('Kg'), 'ionInput', { value: '20' });
    ionEvent(await screen.findByLabelText('Reps'), 'ionInput', { value: '4' });
    await user.click(await screen.findByTestId('sheet-done'));
    await waitFor(async () => {
      const sets = await ctx.db.sets.where('sessionId').equals(sessionId).toArray();
      expect(sets.filter((s) => s.done)).toHaveLength(2);
    });
    expect(await getRestTimer(ctx)).toBeUndefined();
  });
});
