import { programChoiceSlots, saveChoice, testFlowTargetCycle } from '../domain/choice';
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
    choices?: { slotId: string; optionIndex: number }[];
  },
): Promise<TestResult[]> {
  const { db } = ctx;
  const choices = input.choices ?? [];
  return db.transaction(
    'rw',
    [db.sessions, db.testResults, db.programs, db.dayTemplates],
    async () => {
      const session = await db.sessions.get(input.sessionId);
      if (!session) throw new Error(`No session ${input.sessionId}`);
      const results = input.results.map((r) =>
        TestResultSchema.parse(
          clean({
            ...r,
            id: ctx.newId(),
            sessionId: session.id,
            date: session.date,
            nextCycleChoice: choices[0] ?? null,
          }),
        ),
      );
      if (choices.length > 0 && session.programId !== null) {
        const days = await db.dayTemplates.where('programId').equals(session.programId).toArray();
        const slots = programChoiceSlots(days);
        for (const { slotId, optionIndex } of choices) {
          const slot = slots.find((s) => s.id === slotId);
          if (!slot?.options[optionIndex]) throw new Error('This program has no such choice.');
        }
      }
      await db.testResults.where('sessionId').equals(session.id).delete();
      await db.testResults.bulkAdd(results);

      if (choices.length > 0 && session.programId !== null) {
        const program = await db.programs.get(session.programId);
        if (program) {
          const cycle = testFlowTargetCycle(session.cycleNumber ?? 0);
          const updated = choices.reduce(
            (p, c) => saveChoice(p, c.slotId, cycle, c.optionIndex),
            program,
          );
          await db.programs.put(updated);
        }
      }
      return results;
    },
  );
}

/** Oldest first. */
export async function listTestResults(ctx: DataContext): Promise<TestResult[]> {
  const all = await ctx.db.testResults.toArray();
  return all.sort((a, b) => a.date.localeCompare(b.date));
}
