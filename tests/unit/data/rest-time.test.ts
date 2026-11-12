import { describe, expect, it } from 'vitest';
import { skipRestTimer, startRestTimer } from '../../../src/data/rest-timer';
import { seedIfNeeded } from '../../../src/data/seed';
import { finishSession, startEmptySession } from '../../../src/data/sessions';
import { sessionTimes } from '../../../src/domain/consistency';
import { testContext } from './helpers';

describe('rest time', () => {
  it('adds up rests skipped early, cut short by the next set, and running at the end', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const { session } = await startEmptySession(ctx);

    await startRestTimer(ctx, session.id, 120);
    ctx.clock.advance(60_000);
    await skipRestTimer(ctx); // 1 min

    ctx.clock.advance(5 * 60_000);
    await startRestTimer(ctx, session.id, 120);
    ctx.clock.advance(30_000);
    await startRestTimer(ctx, session.id, 120); // the first only ran 30s

    ctx.clock.advance(5 * 60_000); // this one ran out at 2 min
    await startRestTimer(ctx, session.id, 90);
    ctx.clock.advance(45_000);
    const { session: finished } = await finishSession(ctx, session.id); // 45s still running

    expect(finished.restMs).toBe(60_000 + 30_000 + 120_000 + 45_000);
    expect(sessionTimes(finished)).toMatchObject({
      restMs: 255_000,
      workingMs: (finished.finishedAt ?? 0) - finished.startedAt - 255_000,
    });
  });
});
