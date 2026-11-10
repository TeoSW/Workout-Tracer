import { useIonRouter } from '@ionic/react';
import { useCallback } from 'react';
import { useData } from '../../app/DataProvider';
import { startEmptySession, startPlannedSession } from '../../data/sessions';
import { unlockAudio } from '../../pwa/audio';

const WORKOUT = '/tabs/today/workout';

/** Starting runs from a tap, which is what iOS needs to allow the rest sound later. */
export function useStartWorkout() {
  const ctx = useData();
  const router = useIonRouter();

  const startDay = useCallback(
    async (input: {
      programId: string;
      dayTemplateId: string;
      rotationIndex?: number;
      cycleWeek?: number;
    }) => {
      unlockAudio();
      await startPlannedSession(ctx, input);
      router.push(WORKOUT, 'forward', 'replace');
    },
    [ctx, router],
  );

  const startEmpty = useCallback(async () => {
    unlockAudio();
    await startEmptySession(ctx);
    router.push(WORKOUT, 'forward', 'replace');
  }, [ctx, router]);

  const resume = useCallback(() => {
    unlockAudio();
    router.push(WORKOUT);
  }, [router]);

  return { startDay, startEmpty, resume };
}
