import { IonButton, useIonRouter, useIonToast } from '@ionic/react';

/**
 * Editors save each change as it's made, but a field only reports its change when it loses
 * focus. Save takes the focus away first, so the field being typed in is saved too, then
 * confirms and goes back.
 */
export function SaveButton({ back }: { back: string }) {
  const router = useIonRouter();
  const [present] = useIonToast();
  return (
    <IonButton
      strong
      onClick={() => {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement) focused.blur();
        setTimeout(() => {
          void present({ message: 'Saved', duration: 1200, position: 'top' });
          if (router.canGoBack()) router.goBack();
          else router.push(back, 'back', 'replace');
        }, 50);
      }}
    >
      Save
    </IonButton>
  );
}
