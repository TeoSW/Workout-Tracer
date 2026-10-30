import { setRowsToCsv, type CsvSetRow } from '../domain/csv';
import { bandLevel } from '../domain/load';
import { loadBandMap } from './bands';
import type { DataContext } from './context';
import { loadExerciseMap } from './exercises';

/** Done sets of finished sessions, oldest first, as CSV for a spreadsheet. */
export async function exportCsv(ctx: DataContext): Promise<string> {
  const { db } = ctx;
  const [sessions, sessionExercises, sets, programs, exercises, bands] = await Promise.all([
    db.sessions.where('status').equals('finished').toArray(),
    db.sessionExercises.toArray(),
    db.sets.toArray(),
    db.programs.toArray(),
    loadExerciseMap(ctx),
    loadBandMap(ctx),
  ]);
  const programNames = new Map(programs.map((p) => [p.id, p.name]));
  sessions.sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt);

  const rows: CsvSetRow[] = [];
  for (const session of sessions) {
    const ses = sessionExercises
      .filter((e) => e.sessionId === session.id)
      .sort((a, b) => a.order - b.order);
    for (const se of ses) {
      const done = sets
        .filter((s) => s.sessionExerciseId === se.id && s.done)
        .sort((a, b) => a.order - b.order);
      done.forEach((set, i) => {
        rows.push({
          date: session.date,
          program: session.programId === null ? '' : (programNames.get(session.programId) ?? ''),
          day: session.name,
          exercise: exercises.get(set.exerciseId)?.name ?? set.exerciseId,
          setNumber: i + 1,
          kind: set.kind,
          kg: set.kg,
          addedKg: set.addedKg,
          bandLevel: set.bandIds?.length ? bandLevel(set.bandIds, bands) : undefined,
          reps: set.reps,
          seconds: set.seconds,
          attempts: set.attempts,
          cleanAttempts: set.cleanAttempts,
          clean: set.clean,
          rir: set.rir,
          note: set.note,
        });
      });
    }
  }
  return setRowsToCsv(rows);
}
