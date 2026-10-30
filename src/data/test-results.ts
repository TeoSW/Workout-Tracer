import { saveChoice, testFlowTargetCycle } from '../domain/choice';
import { TestResultSchema, type TestResult } from '../domain/schemas';
import { clean } from './clean';
import type { DataContext } from './context';

export type TestResultInput = Pick<
  TestResult,
  'exerciseId' | 'progressionLevel' | 'bestHoldSec' | 'note'
>;

/**
 * Saves the test flow: one result per hold exercise, and the accessory picked for the next
 * cycle. Saving again for the same session replaces its earlier results.
 */
export async function saveTestResults(
  ctx: DataContext,
  input: {
    sessionId: string;
    results: TestResultInput[];
    choice?: { slotId: string; optionIndex: number };
  },
): Promise<TestResult[]> {
  const { db } = ctx;
  return db.transaction('rw', [db.sessions, db.testResults, db.programs], async () => {
    const session = await db.sessions.get(input.sessionId);
    if (!session) throw new Error(`No session ${input.sessionId}`);
    const results = input.results.map((r) =>
      TestResultSchema.parse(
        clean({
          ...r,
          id: ctx.newId(),
          sessionId: session.id,
          date: session.date,
          nextCycleChoice: input.choice ?? null,
        }),
      ),
    );
    await db.testResults.where('sessionId').equals(session.id).delete();
    await db.testResults.bulkAdd(results);

    if (input.choice && session.programId !== null) {
      const program = await db.programs.get(session.programId);
      if (program) {
        const cycle = testFlowTargetCycle(session.cycleNumber ?? 0);
        await db.programs.put(
          saveChoice(program, input.choice.slotId, cycle, input.choice.optionIndex),
        );
      }
    }
    return results;
  });
}

/** Oldest first. */
export async function listTestResults(ctx: DataContext): Promise<TestResult[]> {
  const all = await ctx.db.testResults.toArray();
  return all.sort((a, b) => a.date.localeCompare(b.date));
}
