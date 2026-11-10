import { IonButton, useIonRouter, useIonToast } from '@ionic/react';
import { useEffect, useRef } from 'react';

/**
 * Editors save each change as it's made, but a field only reports its change when it loses
 * focus. Save takes the focus away first, so the field being typed in is saved too, then
 * confirms and goes back.
 */
export function SaveButton({ back, error = null }: { back: string; error?: string | null }) {
  const router = useIonRouter();
  const [present] = useIonToast();
  // Read after the wait, so an error from the change Save just flushed is seen.
  const latestError = useRef(error);
  useEffect(() => {
    latestError.current = error;
  }, [error]);
  return (
    <IonButton
      strong
      onClick={() => {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement) focused.blur();
        setTimeout(() => {
          if (latestError.current) return;
          void present({ message: 'Saved', duration: 1200, position: 'top' });
          if (router.canGoBack()) router.goBack();
          else router.push(back, 'back', 'replace');
        }, 150);
      }}
    >
      Save
    </IonButton>
  );
}
