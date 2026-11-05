import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activateProgram, createProgramFromTemplate, getProgram } from '../../src/data/programs';
import { getRestTimer } from '../../src/data/rest-timer';
import { seedIfNeeded } from '../../src/data/seed';
import {
  addExercise,
  finishSession,
  getActiveSession,
  startEmptySession,
  startPlannedSession,
  updateSet,
} from '../../src/data/sessions';
import { setSetting } from '../../src/data/settings';
import { listTestResults } from '../../src/data/test-results';
import { PROGRAM_C } from '../../src/domain/fixtures/templates';
import type { DayTemplate } from '../../src/domain/schemas';
import { testContext } from '../unit/data/helpers';
import { buttonLabelled, confirmAlert, ionEvent, renderApp, selectLabelled } from './helpers';

const WORKOUT = '/tabs/today/workout';

vi.mock('../../src/pwa/audio', () => ({ unlockAudio: vi.fn(), playRestTone: vi.fn(() => true) }));

async function setup(dayName?: string) {
  const ctx = testContext();
  await seedIfNeeded(ctx);
  const { program, dayTemplates } = await createProgramFromTemplate(ctx, PROGRAM_C);
  await activateProgram(ctx, program.id, 'this_week');
  const day = dayTemplates.find((d) => d.name === dayName) as DayTemplate;
  const view = dayName
    ? await startPlannedSession(ctx, { programId: program.id, dayTemplateId: day.id })
    : null;
  return { ctx, program, day, view };
}

async function empty(...exerciseIds: string[]) {
  const ctx = testContext();
  await seedIfNeeded(ctx);
  const { session } = await startEmptySession(ctx);
  for (const id of exerciseIds) await addExercise(ctx, session.id, id);
  return { ctx, session };
}

const doneButton = () => screen.findByTestId('sheet-done');

describe('logger cards', () => {
  it('shows each exercise with its plan line and pending sets', async () => {
    const { ctx } = await setup('Heavy (planche first)');
    renderApp(WORKOUT, ctx);
    expect(await screen.findByText('Planche Complex')).toBeInTheDocument();
    expect(screen.getByText('3 x hold 3s, press 3, push-up 3 · band 25kg')).toBeInTheDocument();
    expect(screen.getByText('2 x 8 · +25kg')).toBeInTheDocument();
    expect(screen.getAllByText('tap to log').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Weak-point accessory: pick one')).toHaveLength(1);
  });

  it('hints at last time, from any program', async () => {
    const { ctx } = await setup();
    const a = await startEmptySession(ctx);
    const squatA = await addExercise(ctx, a.session.id, 'squat');
    await updateSet(ctx, squatA.sets[0]?.id ?? '', { kg: 20, reps: 10, done: true });
    await finishSession(ctx, a.session.id);
    const b = await startEmptySession(ctx);
    await addExercise(ctx, b.session.id, 'squat');
    renderApp(WORKOUT, ctx);
    expect(await screen.findByText('last: 20kg x 10')).toBeInTheDocument();
  });

  it('picks a choice, shows why to pick each, and saves it for the cycle', async () => {
    const { ctx, program } = await setup('Heavy (planche first)');
    const { user } = renderApp(WORKOUT, ctx);
    expect(await screen.findByText('Your body line breaks on either element.')).toBeInTheDocument();
    await user.click(screen.getByText('Hollow Body Hold'));
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.exercises.map((e) => e.exerciseId)).toContain(
        'hollow-body-hold',
      ),
    );
    await waitFor(async () =>
      expect((await getProgram(ctx, program.id))?.program.choiceSelections).toHaveLength(1),
    );
  });

  it('adds a set and shows the upper limit', async () => {
    const { ctx } = await setup('Light (front lever first)');
    const { user } = renderApp(WORKOUT, ctx);
    expect((await screen.findAllByText('up to 4')).length).toBe(2);
    const [addSet] = screen.getAllByText('Add set');
    await user.click(addSet as HTMLElement);
    await waitFor(async () => {
      const hold = (await getActiveSession(ctx))?.exercises[1];
      expect(hold?.sets).toHaveLength(4);
    });
  });

  it('deletes a set and toggles a warm-up from the swipe actions', async () => {
    const { ctx, session } = await empty('squat');
    const { user } = renderApp(WORKOUT, ctx);
    await user.click(await screen.findByText('Warm-up'));
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.exercises[0]?.sets[0]?.kind).toBe('warmup'),
    );
    await user.click(await screen.findByText('Delete'));
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.exercises[0]?.sets).toHaveLength(0),
    );
    expect(session.status).toBe('active');
  });

  it('toggles a checklist item with no rest', async () => {
    const { ctx } = await setup('Heavy (planche first)');
    renderApp(WORKOUT, ctx);
    ionEvent(await screen.findByLabelText('Warm-up done'), 'ionChange', { checked: true });
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.exercises[0]?.sets[0]?.done).toBe(true),
    );
    expect(await getRestTimer(ctx)).toBeUndefined();
  });

  it('discards a workout after confirming', async () => {
    const { ctx } = await empty('squat');
    const { user } = renderApp(WORKOUT, ctx);
    await user.click(await screen.findByText('Discard workout'));
    await confirmAlert(user, 'Discard');
    await waitFor(async () => expect(await getActiveSession(ctx)).toBeNull());
  });

  it('adds an exercise from the library', async () => {
    const { ctx } = await empty();
    const { user } = renderApp(`${WORKOUT}/add`, ctx);
    await user.click(await screen.findByText('Plank'));
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.exercises.map((e) => e.exerciseId)).toEqual(['plank']),
    );
  });
});

describe('set sheet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('logs a weighted set, prefilled from the plan, and starts the rest', async () => {
    const { ctx, session } = await empty('squat');
    const view = await getActiveSession(ctx);
    const setId = view?.exercises[0]?.sets[0]?.id ?? '';
    await updateSet(ctx, setId, { target: { repsMin: 8, loadMinKg: 20 } });
    const { user } = renderApp(WORKOUT, ctx);
    await user.click(await screen.findByText('Set 1'));
    await user.click(await doneButton());
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.exercises[0]?.sets[0]).toMatchObject({
        kg: 20,
        reps: 8,
        done: true,
      }),
    );
    expect(await screen.findByText('Set 1 · 20kg x 8')).toBeInTheDocument();
    await waitFor(async () =>
      expect(await getRestTimer(ctx)).toMatchObject({ sessionId: session.id, durationSec: 120 }),
    );
  });

  it('does not start the rest again when a done set is edited', async () => {
    const { ctx } = await empty('squat');
    const view = await getActiveSession(ctx);
    await updateSet(ctx, view?.exercises[0]?.sets[0]?.id ?? '', { kg: 20, reps: 8, done: true });
    const { user } = renderApp(WORKOUT, ctx);
    await user.click(await screen.findByText('Set 1 · 20kg x 8'));
    await user.click(await doneButton());
    await new Promise((r) => setTimeout(r, 100));
    expect(await getRestTimer(ctx)).toBeUndefined();
  });

  it('refuses a set without reps', async () => {
    const { ctx } = await empty('squat');
    const { user } = renderApp(WORKOUT, ctx);
    await user.click(await screen.findByText('Set 1'));
    await user.click(await doneButton());
    expect(await screen.findByText('Enter the reps.')).toBeInTheDocument();
  });

  it('stores RPE as RIR through the chips', async () => {
    const { ctx } = await empty('squat');
    await setSetting(ctx, 'effortMode', 'rpe');
    const { user } = renderApp(WORKOUT, ctx);
    await user.click(await screen.findByText('Set 1'));
    ionEvent(await screen.findByLabelText('Reps'), 'ionInput', { value: '10' });
    await user.click(await screen.findByText('RPE 8.5'));
    await user.click(await doneButton());
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.exercises[0]?.sets[0]).toMatchObject({
        reps: 10,
        rir: 1.5,
      }),
    );
    expect(await screen.findByText('Set 1 · 0kg x 10 · RPE 8.5')).toBeInTheDocument();
  });

  it('logs a hold with the stopwatch, level and clean flag', async () => {
    const { ctx } = await empty('planche-hold');
    const { user } = renderApp(WORKOUT, ctx);
    await user.click(await screen.findByText('Set 1'));
    await user.click(await screen.findByText('Start timer'));
    ctx.clock.advance(8_000);
    await user.click(await screen.findByText('Stop timer'));
    ionEvent(selectLabelled('Level'), 'ionChange', { value: 'Tuck' });
    ionEvent(screen.getByLabelText('Clean'), 'ionChange', { checked: true });
    await user.click(await doneButton());
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.exercises[0]?.sets[0]).toMatchObject({
        seconds: 8,
        progressionLevel: 'Tuck',
        clean: true,
        done: true,
      }),
    );
    expect(await screen.findByText('Set 1 · Tuck · 8s · clean')).toBeInTheDocument();
  });

  it('logs a complex part by part', async () => {
    const { ctx } = await setup('Heavy (planche first)');
    const { user } = renderApp(WORKOUT, ctx);
    const card = (await screen.findByText('Planche Complex')).closest('ion-list') as HTMLElement;
    await user.click(within(card).getByText('Set 1'));
    await user.click(await buttonLabelled('More press'));
    await user.click(await doneButton());
    await waitFor(async () => {
      const complex = (await getActiveSession(ctx))?.exercises[1];
      expect(complex?.sets[0]?.parts?.map((p) => p.value)).toEqual([3, 4, 3]);
      expect(complex?.sets[0]?.bandIds).toEqual(['band-25']);
    });
  });

  it('counts attempts, with undo', async () => {
    const { ctx } = await empty('540');
    const { user } = renderApp(WORKOUT, ctx);
    await user.click(await screen.findByText('Set 1'));
    await user.click(await screen.findByText('+ clean'));
    await user.click(screen.getByText('+ miss'));
    await user.click(screen.getByText('+ miss'));
    await user.click(screen.getByText('Undo'));
    expect(await screen.findByText('1 of 2 clean')).toBeInTheDocument();
    await user.click(await doneButton());
    await waitFor(async () =>
      expect((await getActiveSession(ctx))?.exercises[0]?.sets[0]).toMatchObject({
        attempts: 2,
        cleanAttempts: 1,
      }),
    );
  });

  it('keeps added kg and bands apart', async () => {
    const { ctx } = await empty('pull-ups');
    const { user } = renderApp(WORKOUT, ctx);
    await user.click(await screen.findByText('Set 1'));
    ionEvent(await screen.findByLabelText('Reps'), 'ionInput', { value: '8' });
    ionEvent(screen.getByLabelText('Added kg'), 'ionInput', { value: '10' });
    await user.click(await screen.findByText('Band 15kg'));
    await user.click(await doneButton());
    await waitFor(async () => {
      const set = (await getActiveSession(ctx))?.exercises[0]?.sets[0];
      expect(set).toMatchObject({ bandIds: ['band-15'], done: true });
      expect(set?.addedKg).toBeUndefined();
    });
  });
});

describe('rest bar', () => {
  async function resting() {
    const { ctx, session } = await empty('squat');
    const view = await getActiveSession(ctx);
    const { startRestTimer } = await import('../../src/data/rest-timer');
    await startRestTimer(ctx, session.id, 90);
    return { ctx, view };
  }

  it('shows the time, adds 15 seconds and skips', async () => {
    const { ctx } = await resting();
    const { user } = renderApp('/tabs/history', ctx);
    expect(await screen.findByText('1:30')).toBeInTheDocument();
    await user.click(screen.getByText('+15s'));
    expect(await screen.findByText('1:45')).toBeInTheDocument();
    await user.click(screen.getByText('Skip'));
    await waitFor(() => expect(screen.queryByTestId('rest-bar')).not.toBeInTheDocument());
    expect(await getRestTimer(ctx)).toBeUndefined();
  });

  it('computes from the end time, plays the tone once and says rest is over', async () => {
    const { playRestTone } = await import('../../src/pwa/audio');
    const { ctx } = await resting();
    renderApp('/tabs/today', ctx);
    await screen.findByText('1:30');
    ctx.clock.advance(60_000);
    expect(await screen.findByText('0:30')).toBeInTheDocument();
    ctx.clock.advance(30_000);
    expect(await screen.findByText('Rest over')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 400));
    expect(playRestTone).toHaveBeenCalledOnce();
  });

  it('stays silent with sound off', async () => {
    const { playRestTone } = await import('../../src/pwa/audio');
    vi.mocked(playRestTone).mockClear();
    const { ctx } = await resting();
    await setSetting(ctx, 'sound', false);
    renderApp('/tabs/today', ctx);
    await screen.findByText('1:30');
    ctx.clock.advance(90_000);
    expect(await screen.findByText('Rest over')).toBeInTheDocument();
    expect(playRestTone).not.toHaveBeenCalled();
  });
});

describe('finish', () => {
  it('confirms, then shows the summary with PRs and saves notes', async () => {
    const { ctx, session } = await empty('squat');
    const view = await getActiveSession(ctx);
    await updateSet(ctx, view?.exercises[0]?.sets[0]?.id ?? '', {
      kg: 25,
      reps: 10,
      rir: 2,
      done: true,
    });
    await finishSession(ctx, session.id);
    ctx.clock.advance(60_000);

    const next = await startEmptySession(ctx);
    const squat = await addExercise(ctx, next.session.id, 'squat');
    await updateSet(ctx, squat.sets[0]?.id ?? '', { kg: 25, reps: 11, rir: 2, done: true });
    ctx.clock.advance(1_800_000);

    const { user } = renderApp(WORKOUT, ctx);
    await user.click(await screen.findByTestId('finish-workout'));
    await confirmAlert(user, 'Finish');
    expect(await screen.findByText('Summary')).toBeInTheDocument();
    expect(await screen.findByText('30m')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(await screen.findByText('Squat: best e1RM trend 35.83kg')).toBeInTheDocument();
    expect(screen.getByText('Squat: 11 reps at 25kg')).toBeInTheDocument();
    ionEvent(screen.getByLabelText('Session notes'), 'ionChange', { value: 'Felt strong.' });
    await waitFor(async () =>
      expect((await ctx.db.sessions.get(next.session.id))?.notes).toBe('Felt strong.'),
    );
  });

  it('continues a test day to the test flow and saves the pick for next cycle', async () => {
    const { ctx, program, view } = await setup('Test');
    const hold = view?.exercises.find((e) => e.exerciseId === 'planche-hold');
    await updateSet(ctx, hold?.sets[0]?.id ?? '', {
      seconds: 9,
      progressionLevel: 'Tuck',
      clean: true,
      done: true,
    });
    const { user } = renderApp(WORKOUT, ctx);
    await user.click(await screen.findByTestId('finish-workout'));
    await confirmAlert(user, 'Finish');
    await user.click(await screen.findByText('Continue'));

    const seconds = await screen.findByLabelText('Planche Hold best clean hold');
    expect(seconds).toHaveValue(9);
    ionEvent(screen.getByLabelText('Planche Hold note'), 'ionInput', { value: 'Hips sag.' });
    await user.click(await screen.findByText('Hollow Body Hold'));
    await user.click(screen.getByText('Save results'));

    await waitFor(async () =>
      expect(await listTestResults(ctx)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            exerciseId: 'planche-hold',
            bestHoldSec: 9,
            progressionLevel: 'Tuck',
            note: 'Hips sag.',
          }),
        ]),
      ),
    );
    expect((await getProgram(ctx, program.id))?.program.choiceSelections).toMatchObject([
      { cycleNumber: 2, optionIndex: 2 },
    ]);
  });
});

describe('review fixes', () => {
  it('stays silent when the app returns long after rest ended', async () => {
    const { playRestTone } = await import('../../src/pwa/audio');
    vi.mocked(playRestTone).mockClear();
    const { ctx, session } = await empty('squat');
    const { startRestTimer } = await import('../../src/data/rest-timer');
    await startRestTimer(ctx, session.id, 90);
    renderApp('/tabs/today', ctx);
    await screen.findByText('1:30');
    ctx.clock.advance(600_000);
    expect(await screen.findByText('Rest over')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 300));
    expect(playRestTone).not.toHaveBeenCalled();
  });

  it('saves picks for every choice slot in the test flow', async () => {
    const { ctx, program, view, day } = await setup('Test');
    const extra = {
      ...day,
      blocks: [
        ...day.blocks,
        {
          kind: 'choice' as const,
          id: 'second',
          order: 9,
          setsMin: 3,
          target: {},
          warmupSets: 0,
          choiceSlot: {
            id: 'second-slot',
            label: 'Second slot',
            options: [{ exerciseId: 'plank', setsMin: 3, target: {}, pickWhen: 'Always.' }],
          },
        },
      ],
    };
    await ctx.db.dayTemplates.put(extra);
    await finishSession(ctx, view?.session.id ?? '');
    const { user } = renderApp(`/tabs/today/test/${view?.session.id}`, ctx);
    await user.click(await screen.findByText('Plank'));
    await user.click(await screen.findByText('Hollow Body Hold'));
    await user.click(screen.getByText('Save results'));
    await waitFor(async () =>
      expect((await getProgram(ctx, program.id))?.program.choiceSelections).toHaveLength(2),
    );
  });
});
