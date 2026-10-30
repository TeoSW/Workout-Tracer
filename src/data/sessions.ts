import { resolveChoiceBlock, saveChoice } from '../domain/choice';
import { resolvePlan } from '../domain/plan';
import { detectPrs, type PrFlag, type SessionSets } from '../domain/prs';
import { latestFinishedSession, nextRotationIndex, rotationIndexForPick } from '../domain/schedule';
import {
  LoggedSetSchema,
  SessionExerciseSchema,
  SessionSchema,
  validateSetForExercise,
  type LoggedSet,
  type Session,
  type SessionExercise,
} from '../domain/schemas';
import { buildRowsForBlock, buildSessionRows } from '../domain/session-rows';
import { loadBandMap } from './bands';
import { clean } from './clean';
import type { DataContext } from './context';
import { loadExerciseMap } from './exercises';

export type SessionExerciseView = SessionExercise & { sets: LoggedSet[] };
export type SessionView = { session: Session; exercises: SessionExerciseView[] };
export type SessionPr = PrFlag & { exerciseId: string };

/** The values a user logs on a set. Ids and links stay fixed. */
export type SetPatch = Partial<
  Omit<LoggedSet, 'id' | 'sessionId' | 'sessionExerciseId' | 'exerciseId' | 'completedAt'>
>;

const sessionTables = (ctx: DataContext) => [ctx.db.sessions, ctx.db.sessionExercises, ctx.db.sets];

async function requireSession(ctx: DataContext, id: string): Promise<Session> {
  const session = await ctx.db.sessions.get(id);
  if (!session) throw new Error(`No session ${id}`);
  return session;
}

async function requireSessionExercise(ctx: DataContext, id: string): Promise<SessionExercise> {
  const se = await ctx.db.sessionExercises.get(id);
  if (!se) throw new Error(`No session exercise ${id}`);
  return se;
}

async function requireSet(ctx: DataContext, id: string): Promise<LoggedSet> {
  const set = await ctx.db.sets.get(id);
  if (!set) throw new Error(`No set ${id}`);
  return set;
}

async function assertNoActiveSession(ctx: DataContext): Promise<void> {
  const active = await ctx.db.sessions.where('status').equals('active').first();
  if (active) throw new Error('Finish or discard the current workout first.');
}

export async function getSessionView(ctx: DataContext, id: string): Promise<SessionView | null> {
  const session = await ctx.db.sessions.get(id);
  if (!session) return null;
  const [exercises, sets] = await Promise.all([
    ctx.db.sessionExercises.where('sessionId').equals(id).toArray(),
    ctx.db.sets.where('sessionId').equals(id).toArray(),
  ]);
  return {
    session,
    exercises: exercises
      .sort((a, b) => a.order - b.order)
      .map((e) => ({
        ...e,
        sets: sets.filter((s) => s.sessionExerciseId === e.id).sort((a, b) => a.order - b.order),
      })),
  };
}

export async function getActiveSession(ctx: DataContext): Promise<SessionView | null> {
  const active = await ctx.db.sessions.where('status').equals('active').first();
  return active ? getSessionView(ctx, active.id) : null;
}

/**
 * Starts a day of a program. The plan is resolved once, with the deload and any choice picks
 * applied, and stored on the session, so later program edits never change it. For rotations the
 * rotation index is the given one, or the day's first position from the current pointer on.
 */
export async function startPlannedSession(
  ctx: DataContext,
  input: { programId: string; dayTemplateId: string; rotationIndex?: number },
): Promise<SessionView> {
  const { db } = ctx;
  const id = await db.transaction(
    'rw',
    [...sessionTables(ctx), db.programs, db.dayTemplates, db.exercises],
    async () => {
      await assertNoActiveSession(ctx);
      const program = await db.programs.get(input.programId);
      const dayTemplate = await db.dayTemplates.get(input.dayTemplateId);
      if (!program || !dayTemplate || dayTemplate.programId !== program.id) {
        throw new Error('This day is not part of the program.');
      }
      const date = ctx.clock.today();
      const snapshot = resolvePlan({
        program,
        dayTemplate,
        date,
        exercisesById: await loadExerciseMap(ctx),
      });

      let rotationIndex: number | null = null;
      if (program.schedule.kind === 'rotation') {
        if (input.rotationIndex !== undefined) {
          rotationIndex = input.rotationIndex;
        } else {
          const finished = await db.sessions.where('programId').equals(program.id).toArray();
          const pointer = nextRotationIndex(
            program,
            latestFinishedSession(finished, program.id)?.rotationIndex ?? null,
          );
          rotationIndex = rotationIndexForPick(program, pointer, dayTemplate.id);
        }
      }

      const session = SessionSchema.parse(
        clean({
          id: ctx.newId(),
          programId: program.id,
          dayTemplateId: dayTemplate.id,
          cycleNumber: snapshot.cycleNumber,
          cycleWeek: snapshot.cycleWeek,
          rotationIndex,
          name: dayTemplate.name,
          dayType: dayTemplate.dayType,
          isDeload: snapshot.isDeload,
          date,
          startedAt: ctx.clock.now(),
          finishedAt: null,
          status: 'active',
          notes: '',
          planSnapshot: snapshot,
        }),
      );
      const rows = buildSessionRows({ sessionId: session.id, snapshot, newId: ctx.newId });
      await db.sessions.add(session);
      await db.sessionExercises.bulkAdd(clean(rows.sessionExercises));
      await db.sets.bulkAdd(clean(rows.sets));
      return session.id;
    },
  );
  return (await getSessionView(ctx, id)) as SessionView;
}

/** A session with no program. Exercises are added from the library. */
export async function startEmptySession(ctx: DataContext): Promise<SessionView> {
  const id = await ctx.db.transaction('rw', ctx.db.sessions, async () => {
    await assertNoActiveSession(ctx);
    const session = SessionSchema.parse({
      id: ctx.newId(),
      programId: null,
      dayTemplateId: null,
      cycleNumber: null,
      cycleWeek: null,
      rotationIndex: null,
      name: 'Empty workout',
      dayType: 'custom',
      isDeload: false,
      date: ctx.clock.today(),
      startedAt: ctx.clock.now(),
      finishedAt: null,
      status: 'active',
      notes: '',
      planSnapshot: null,
    });
    await ctx.db.sessions.add(session);
    return session.id;
  });
  return (await getSessionView(ctx, id)) as SessionView;
}

/** Logs or edits a set. Marking it done stamps the time; un-marking clears it. */
export async function updateSet(
  ctx: DataContext,
  setId: string,
  patch: SetPatch,
): Promise<LoggedSet> {
  return ctx.db.transaction('rw', [ctx.db.sets, ctx.db.exercises], async () => {
    const current = await requireSet(ctx, setId);
    const merged = { ...current, ...patch };
    if (patch.done === true && !current.done) merged.completedAt = ctx.clock.now();
    if (patch.done === false) merged.completedAt = null;
    const set = LoggedSetSchema.parse(clean(merged));
    const exercise = await ctx.db.exercises.get(set.exerciseId);
    if (exercise) {
      const check = validateSetForExercise(set, exercise);
      if (!check.ok) throw new Error(check.error);
    }
    await ctx.db.sets.put(set);
    return set;
  });
}

/** Adds a working set after the last one, with the same target. */
export async function addSet(ctx: DataContext, sessionExerciseId: string): Promise<LoggedSet> {
  return ctx.db.transaction('rw', [ctx.db.sessionExercises, ctx.db.sets], async () => {
    const se = await requireSessionExercise(ctx, sessionExerciseId);
    const sets = await ctx.db.sets.where('sessionExerciseId').equals(sessionExerciseId).toArray();
    const last = sets.sort((a, b) => a.order - b.order).at(-1);
    const set = LoggedSetSchema.parse(
      clean({
        id: ctx.newId(),
        sessionId: se.sessionId,
        sessionExerciseId,
        exerciseId: se.exerciseId,
        order: last === undefined ? 0 : last.order + 1,
        kind: 'working',
        target: last?.target === undefined ? undefined : structuredClone(last.target),
        rir: null,
        done: false,
        completedAt: null,
      }),
    );
    await ctx.db.sets.add(set);
    return set;
  });
}

export async function removeSet(ctx: DataContext, setId: string): Promise<void> {
  await ctx.db.sets.delete(setId);
}

export async function toggleWarmup(ctx: DataContext, setId: string): Promise<LoggedSet> {
  const set = await requireSet(ctx, setId);
  return updateSet(ctx, setId, { kind: set.kind === 'warmup' ? 'working' : 'warmup' });
}

/** Adds an exercise from the library at the end, with one empty working set. */
export async function addExercise(
  ctx: DataContext,
  sessionId: string,
  exerciseId: string,
): Promise<SessionExerciseView> {
  return ctx.db.transaction('rw', [...sessionTables(ctx), ctx.db.exercises], async () => {
    await requireSession(ctx, sessionId);
    if (!(await ctx.db.exercises.get(exerciseId))) throw new Error(`No exercise ${exerciseId}`);
    const existing = await ctx.db.sessionExercises.where('sessionId').equals(sessionId).toArray();
    const order = existing.reduce((max, e) => Math.max(max, e.order + 1), 0);
    const { sessionExercise, sets } = buildRowsForBlock({
      sessionId,
      block: {
        kind: 'exercise',
        id: 'added',
        order,
        exerciseId,
        setsMin: 1,
        target: {},
        warmupSets: 0,
      },
      order,
      newId: ctx.newId,
    });
    const se = SessionExerciseSchema.parse({ ...sessionExercise, blockId: null });
    const rows = sets.map((s) => {
      const copy = { ...s };
      delete copy.target;
      return copy;
    });
    await ctx.db.sessionExercises.add(se);
    await ctx.db.sets.bulkAdd(clean(rows));
    return { ...se, sets: rows };
  });
}

export async function removeExercise(ctx: DataContext, sessionExerciseId: string): Promise<void> {
  await ctx.db.transaction('rw', [ctx.db.sessionExercises, ctx.db.sets], async () => {
    await ctx.db.sets.where('sessionExerciseId').equals(sessionExerciseId).delete();
    await ctx.db.sessionExercises.delete(sessionExerciseId);
  });
}

/** Swaps places with the neighbouring exercise. Does nothing at either end. */
export async function moveExercise(
  ctx: DataContext,
  sessionExerciseId: string,
  direction: 'up' | 'down',
): Promise<void> {
  await ctx.db.transaction('rw', ctx.db.sessionExercises, async () => {
    const se = await requireSessionExercise(ctx, sessionExerciseId);
    const all = (
      await ctx.db.sessionExercises.where('sessionId').equals(se.sessionId).toArray()
    ).sort((a, b) => a.order - b.order);
    const index = all.findIndex((e) => e.id === se.id);
    const other = all[direction === 'up' ? index - 1 : index + 1];
    if (!other) return;
    await ctx.db.sessionExercises.put({ ...se, order: other.order });
    await ctx.db.sessionExercises.put({ ...other, order: se.order });
  });
}

/** Swaps an exercise for this session only. The original exercise is remembered. */
export async function swapExercise(
  ctx: DataContext,
  sessionExerciseId: string,
  exerciseId: string,
): Promise<void> {
  await ctx.db.transaction(
    'rw',
    [ctx.db.sessionExercises, ctx.db.sets, ctx.db.exercises],
    async () => {
      const se = await requireSessionExercise(ctx, sessionExerciseId);
      if (!(await ctx.db.exercises.get(exerciseId))) throw new Error(`No exercise ${exerciseId}`);
      const original = se.swappedFromExerciseId ?? se.exerciseId;
      await ctx.db.sessionExercises.put({
        ...se,
        exerciseId,
        swappedFromExerciseId: exerciseId === original ? null : original,
      });
      await ctx.db.sets.where('sessionExerciseId').equals(sessionExerciseId).modify({ exerciseId });
    },
  );
}

export async function setExerciseNote(
  ctx: DataContext,
  sessionExerciseId: string,
  note: string,
): Promise<void> {
  const updated = await ctx.db.sessionExercises.update(sessionExerciseId, { note });
  if (updated === 0) throw new Error(`No session exercise ${sessionExerciseId}`);
}

/**
 * Resolves a choice slot that had no pick: the session plan gets the picked exercise (halved in
 * a deload), its rows are created in the block's place, and the pick is saved on the program for
 * the session's cycle.
 */
export async function pickChoice(
  ctx: DataContext,
  sessionId: string,
  blockId: string,
  optionIndex: number,
): Promise<SessionView> {
  const { db } = ctx;
  await db.transaction('rw', [...sessionTables(ctx), db.programs, db.exercises], async () => {
    const session = await requireSession(ctx, sessionId);
    const snapshot = session.planSnapshot;
    const block = snapshot?.blocks.find((b) => b.id === blockId);
    if (!snapshot || block?.kind !== 'choice') throw new Error('This block has no choice to pick.');

    // In a deload the stored choice block is already halved, options and note included.
    const resolved = resolveChoiceBlock(block, optionIndex);
    if (resolved.kind !== 'exercise') throw new Error('Choice did not resolve to an exercise.');

    const blocks = snapshot.blocks.map((b) => (b.id === blockId ? resolved : b));
    await db.sessions.put(
      SessionSchema.parse(clean({ ...session, planSnapshot: { ...snapshot, blocks } })),
    );
    const rows = buildRowsForBlock({
      sessionId,
      block: resolved,
      order: resolved.order,
      newId: ctx.newId,
    });
    await db.sessionExercises.add(clean(rows.sessionExercise));
    await db.sets.bulkAdd(clean(rows.sets));

    if (session.programId !== null && session.cycleNumber !== null) {
      const program = await db.programs.get(session.programId);
      if (program) {
        await db.programs.put(
          saveChoice(program, block.choiceSlot.id, session.cycleNumber, optionIndex),
        );
      }
    }
  });
  return (await getSessionView(ctx, sessionId)) as SessionView;
}

async function prsFor(ctx: DataContext, view: SessionView): Promise<SessionPr[]> {
  const exerciseIds = [...new Set(view.exercises.map((e) => e.exerciseId))];
  if (exerciseIds.length === 0) return [];
  const [exercises, bandsById, bodyweight, history] = await Promise.all([
    loadExerciseMap(ctx),
    loadBandMap(ctx),
    ctx.db.bodyweight.toArray(),
    ctx.db.sets.where('exerciseId').anyOf(exerciseIds).toArray(),
  ]);
  const sessionIds = [...new Set(history.map((s) => s.sessionId))].filter(
    (id) => id !== view.session.id,
  );
  const sessions = (await ctx.db.sessions.bulkGet(sessionIds)).filter(
    (s): s is Session => s !== undefined && s.status === 'finished',
  );
  const current: SessionSets = {
    session: view.session,
    sets: view.exercises.flatMap((e) => e.sets),
  };
  const out: SessionPr[] = [];
  for (const exerciseId of exerciseIds) {
    const exercise = exercises.get(exerciseId);
    if (!exercise) continue;
    const previous = sessions.map((session) => ({
      session,
      sets: history.filter((s) => s.sessionId === session.id && s.exerciseId === exerciseId),
    }));
    for (const pr of detectPrs({ exercise, previous, current, bandsById, bodyweight })) {
      out.push({ ...pr, exerciseId });
    }
  }
  return out;
}

/** Finishes the active session, stops the rest timer and returns the records it beat. */
export async function finishSession(
  ctx: DataContext,
  sessionId: string,
  notes?: string,
): Promise<{ session: Session; prs: SessionPr[] }> {
  const session = await ctx.db.transaction('rw', [ctx.db.sessions, ctx.db.restTimer], async () => {
    const current = await requireSession(ctx, sessionId);
    if (current.status !== 'active') throw new Error('This workout is already finished.');
    const finished = SessionSchema.parse(
      clean({
        ...current,
        status: 'finished',
        finishedAt: ctx.clock.now(),
        notes: notes ?? current.notes,
      }),
    );
    await ctx.db.sessions.put(finished);
    await ctx.db.restTimer.clear();
    return finished;
  });
  const view = (await getSessionView(ctx, sessionId)) as SessionView;
  return { session, prs: await prsFor(ctx, view) };
}

/** Name and notes of a session. Set values are edited with updateSet, finished or not. */
export async function updateSession(
  ctx: DataContext,
  sessionId: string,
  patch: { name?: string; notes?: string },
): Promise<Session> {
  return ctx.db.transaction('rw', ctx.db.sessions, async () => {
    const session = SessionSchema.parse(
      clean({ ...(await requireSession(ctx, sessionId)), ...patch }),
    );
    await ctx.db.sessions.put(session);
    return session;
  });
}

/** Deletes a session with its exercises, sets, test results and rest timer. */
export async function deleteSession(ctx: DataContext, sessionId: string): Promise<void> {
  const { db } = ctx;
  await db.transaction('rw', [...sessionTables(ctx), db.testResults, db.restTimer], async () => {
    await db.sets.where('sessionId').equals(sessionId).delete();
    await db.sessionExercises.where('sessionId').equals(sessionId).delete();
    await db.testResults.where('sessionId').equals(sessionId).delete();
    const timer = await db.restTimer.get('current');
    if (timer?.sessionId === sessionId) await db.restTimer.delete('current');
    await db.sessions.delete(sessionId);
  });
}
