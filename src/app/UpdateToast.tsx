import { IonToast } from '@ionic/react';
import { hasActiveSession } from '../data/sessions';
import { useAppUpdate } from '../pwa/useAppUpdate';
import { useLive } from './DataProvider';

/** Updating reloads the app, so the offer waits until no workout is running. */
export function UpdateToast() {
  const { waiting, apply, dismiss } = useAppUpdate();
  const active = useLive(hasActiveSession);
  return (
    <IonToast
      isOpen={waiting && active === false}
      message="Update available"
      position="top"
      buttons={[
        { text: 'Later', role: 'cancel', handler: dismiss },
        { text: 'Update', handler: apply },
      ]}
    />
  );
}
