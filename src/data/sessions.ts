import { resolveChoiceBlock, saveChoice } from '../domain/choice';
import { resolvePlan } from '../domain/plan';
import { detectPrs, type PrFlag, type SessionSets } from '../domain/prs';
import { lastRotationIndex, nextRotationIndex, rotationIndexForPick } from '../domain/schedule';
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
          if (program.schedule.sequence[input.rotationIndex] !== dayTemplate.id) {
            throw new Error('This day is not at that place in the rotation.');
          }
          rotationIndex = input.rotationIndex;
        } else if (program.schedule.sequence.includes(dayTemplate.id)) {
          const sessions = await db.sessions.where('programId').equals(program.id).toArray();
          const pointer = nextRotationIndex(program, lastRotationIndex(sessions, program.id));
          rotationIndex = rotationIndexForPick(program, pointer, dayTemplate.id);
        }
        // A day outside the sequence has no index, and the rotation carries on where it was.
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
    const session = await requireSession(ctx, sessionId);
    if (!(await ctx.db.exercises.get(exerciseId))) throw new Error(`No exercise ${exerciseId}`);
    const existing = await ctx.db.sessionExercises.where('sessionId').equals(sessionId).toArray();
    // Orders of plan blocks stay reserved, so a choice picked later still gets its own place.
    const used = [
      ...existing.map((e) => e.order),
      ...(session.planSnapshot?.blocks.map((b) => b.order) ?? []),
    ];
    const se = SessionExerciseSchema.parse({
      id: ctx.newId(),
      sessionId,
      exerciseId,
      order: used.reduce((max, o) => Math.max(max, o + 1), 0),
      blockId: null,
      swappedFromExerciseId: null,
      note: '',
    });
    const set = LoggedSetSchema.parse({
      id: ctx.newId(),
      sessionId,
      sessionExerciseId: se.id,
      exerciseId,
      order: 0,
      kind: 'working',
      rir: null,
      done: false,
      completedAt: null,
    });
    await ctx.db.sessionExercises.add(se);
    await ctx.db.sets.add(set);
    return { ...se, sets: [set] };
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
      const sets = await ctx.db.sets.where('sessionExerciseId').equals(sessionExerciseId).toArray();
      if (sets.some((s) => s.done)) {
        throw new Error('Logged sets stay on their exercise. Add the other exercise instead.');
      }
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

    // Editing a finished session from History must not change the program's picks.
    if (session.status === 'active' && session.programId !== null && session.cycleNumber !== null) {
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

/**
 * For each exercise, its sets in the latest finished session that logged it, on any program.
 * The logger reads this for the "last time" hints and prefills.
 */
export async function lastSetsByExercise(
  ctx: DataContext,
  exerciseIds: readonly string[],
  excludeSessionId: string,
): Promise<Map<string, LoggedSet[]>> {
  const result = new Map<string, LoggedSet[]>();
  if (exerciseIds.length === 0) return result;
  const sets = await ctx.db.sets
    .where('exerciseId')
    .anyOf([...exerciseIds])
    .toArray();
  const done = sets.filter((s) => s.done && s.sessionId !== excludeSessionId);
  const sessionIds = [...new Set(done.map((s) => s.sessionId))];
  const sessions = await ctx.db.sessions.bulkGet(sessionIds);
  const startedAt = new Map(
    sessions.flatMap((s) => (s?.status === 'finished' ? [[s.id, s.startedAt] as const] : [])),
  );

  const latest = new Map<string, string>();
  for (const set of done) {
    const at = startedAt.get(set.sessionId);
    if (at === undefined) continue;
    const best = latest.get(set.exerciseId);
    if (best === undefined || at > (startedAt.get(best) ?? 0)) {
      latest.set(set.exerciseId, set.sessionId);
    }
  }
  for (const set of done) {
    if (latest.get(set.exerciseId) !== set.sessionId) continue;
    const list = result.get(set.exerciseId);
    if (list) list.push(set);
    else result.set(set.exerciseId, [set]);
  }
  return result;
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
  // Only earlier sessions count, so a summary reads the same when it is opened again later.
  const cutoff = view.session.startedAt;
  const sessions = (await ctx.db.sessions.bulkGet(sessionIds)).filter(
    (s): s is Session => s !== undefined && s.status === 'finished' && s.startedAt < cutoff,
  );
  const current: SessionSets = {
    session: view.session,
    sets: view.exercises.flatMap((e) => e.sets),
  };
  // detectPrs picks out the sets of its own exercise, so one grouping by session serves all.
  const bySession = new Map<string, LoggedSet[]>();
  for (const set of history) {
    const list = bySession.get(set.sessionId);
    if (list) list.push(set);
    else bySession.set(set.sessionId, [set]);
  }
  const previous = sessions.map((session) => ({ session, sets: bySession.get(session.id) ?? [] }));
  const out: SessionPr[] = [];
  for (const exerciseId of exerciseIds) {
    const exercise = exercises.get(exerciseId);
    if (!exercise) continue;
    for (const pr of detectPrs({ exercise, previous, current, bandsById, bodyweight })) {
      out.push({ ...pr, exerciseId });
    }
  }
  return out;
}

/** The records a session beat. The finish summary reads this. */
export async function sessionPrs(ctx: DataContext, sessionId: string): Promise<SessionPr[]> {
  const view = await getSessionView(ctx, sessionId);
  return view ? prsFor(ctx, view) : [];
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

const MAX_DURATION_MINUTES = 24 * 60;

/** Corrects the length of a finished workout, which matters when it was finished late. */
export async function setSessionDuration(
  ctx: DataContext,
  sessionId: string,
  minutes: number,
): Promise<Session> {
  if (!(minutes >= 1)) throw new Error('A workout lasts at least one minute.');
  if (minutes > MAX_DURATION_MINUTES) throw new Error('A workout lasts at most 24 hours.');
  return ctx.db.transaction('rw', ctx.db.sessions, async () => {
    const current = await requireSession(ctx, sessionId);
    if (current.status !== 'finished') throw new Error('This workout is still running.');
    const session = SessionSchema.parse(
      clean({ ...current, finishedAt: current.startedAt + Math.round(minutes * 60_000) }),
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
