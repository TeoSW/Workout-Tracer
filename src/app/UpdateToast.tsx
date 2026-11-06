import { IonToast } from '@ionic/react';
import { hasActiveSession } from '../data/sessions';
import type { AppUpdate } from '../pwa/useAppUpdate';
import { useLive } from './DataProvider';

/** Updating reloads the app, so the offer waits until no workout is running. */
export function UpdateToast({ update }: { update: AppUpdate }) {
  const { waiting, apply, dismiss } = update;
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
