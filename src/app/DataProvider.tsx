import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { DataContext } from '../data/context';
import { seedIfNeeded } from '../data/seed';

const Data = createContext<DataContext | null>(null);

/** Seeds on first launch, then gives every screen access to the repositories. */
export function DataProvider({ ctx, children }: { ctx: DataContext; children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    seedIfNeeded(ctx).then(
      () => {
        if (!cancelled) setState('ready');
      },
      () => {
        if (!cancelled) setState('failed');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  if (state === 'failed') return <p>The app could not open its data on this device.</p>;
  if (state === 'loading') return null;
  return <Data.Provider value={ctx}>{children}</Data.Provider>;
}

export function useData(): DataContext {
  const ctx = useContext(Data);
  if (!ctx) throw new Error('useData needs a DataProvider');
  return ctx;
}

/**
 * Today's date, kept current. An installed app can sit in memory overnight, so the date is read
 * again whenever the app comes back and once a minute while it is open.
 */
export function useToday(): string {
  const ctx = useData();
  const [today, setToday] = useState(() => ctx.clock.today());
  useEffect(() => {
    const refresh = () => setToday(ctx.clock.today());
    const tick = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [ctx]);
  return today;
}

/** A repository read that updates when the data changes. Undefined until the first result. */
export function useLive<T>(
  query: (ctx: DataContext) => Promise<T>,
  deps: unknown[] = [],
): T | undefined {
  const ctx = useData();
  return useLiveQuery(() => query(ctx), [ctx, ...deps]);
}
