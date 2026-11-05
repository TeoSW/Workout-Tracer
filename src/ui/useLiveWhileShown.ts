import { useIonViewDidEnter, useIonViewWillLeave } from '@ionic/react';
import { useRef, useState } from 'react';
import { useLive } from '../app/DataProvider';
import type { DataContext } from '../data/context';

/**
 * A live read for heavy pages. Ionic keeps left pages mounted, so a read over every logged set
 * would rerun on each set of a workout. This one rests while its page is hidden and reads again
 * when the page comes back.
 */
export function useLiveWhileShown<T>(query: (ctx: DataContext) => Promise<T>): T | undefined {
  const [shown, setShown] = useState(true);
  useIonViewDidEnter(() => setShown(true));
  useIonViewWillLeave(() => setShown(false));
  const last = useRef<T | undefined>(undefined);
  const value = useLive(
    async (ctx) => {
      if (!shown) return last.current;
      last.current = await query(ctx);
      return last.current;
    },
    [shown],
  );
  return value;
}
