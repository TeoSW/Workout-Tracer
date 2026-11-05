import { useIonAlert } from '@ionic/react';
import { useCallback } from 'react';

/** Asks before something that cannot be undone. Resolves true when confirmed. */
export function useConfirm() {
  const [present] = useIonAlert();
  return useCallback(
    (options: { header: string; message?: string; confirm: string }) =>
      new Promise<boolean>((resolve) => {
        void present({
          header: options.header,
          ...(options.message === undefined ? {} : { message: options.message }),
          buttons: [
            { text: 'Cancel', role: 'cancel', handler: () => resolve(false) },
            { text: options.confirm, role: 'destructive', handler: () => resolve(true) },
          ],
          backdropDismiss: false,
        });
      }),
    [present],
  );
}
