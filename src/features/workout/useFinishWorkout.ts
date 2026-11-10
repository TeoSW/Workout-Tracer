import { useIonRouter } from '@ionic/react';
import { useCallback } from 'react';
import { useData } from '../../app/DataProvider';
import { finishSession } from '../../data/sessions';
import { allowSleep } from '../../pwa/wake-lock';
import { useConfirm } from '../../ui/useConfirm';

/** Ends a workout after asking, then shows its summary. The logger and Today both use it. */
export function useFinishWorkout(guard: (action: () => Promise<unknown>) => Promise<void>) {
  const ctx = useData();
  const router = useIonRouter();
  const confirm = useConfirm();
  return useCallback(
    async (sessionId: string) => {
      const yes = await confirm({ header: 'End this workout?', confirm: 'End workout' });
      if (!yes) return;
      await guard(async () => {
        await finishSession(ctx, sessionId);
        await allowSleep();
        router.push(`/tabs/today/summary/${sessionId}`, 'forward', 'replace');
      });
    },
    [ctx, router, confirm, guard],
  );
}
