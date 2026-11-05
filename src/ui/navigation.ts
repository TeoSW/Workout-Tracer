import { useIonRouter } from '@ionic/react';
import { useCallback } from 'react';

/** Goes back when there is history, otherwise to a fallback route. Works from a deep link too. */
export function useGoBack(fallback: string): () => void {
  const router = useIonRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.goBack();
    else router.push(fallback, 'back', 'replace');
  }, [router, fallback]);
}
