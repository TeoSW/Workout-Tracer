import { useCallback, useState } from 'react';

/** Runs a save and keeps its error for the page to show, so a failed save never goes unnoticed. */
export function useGuard() {
  const [error, setError] = useState<string | null>(null);
  const guard = useCallback(async (action: () => Promise<unknown>) => {
    try {
      await action();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, []);
  return { error, guard, setError };
}

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="error-note" role="alert">
      {error}
    </p>
  );
}
