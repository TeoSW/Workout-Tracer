import { IonItem, IonLabel, IonList } from '@ionic/react';
import { isStandalone } from '../../pwa/install';

/** Storage in a Safari tab is separate from the installed app, so this stays until they move. */
export function InstallBanner() {
  if (isStandalone()) return null;
  return (
    <IonList inset>
      <IonItem>
        <IonLabel className="ion-text-wrap notice">
          <h2>Install this app</h2>
          <p>
            Tap Share, then Add to Home Screen. Data saved in this Safari tab won't appear in the
            installed app.
          </p>
        </IonLabel>
      </IonItem>
    </IonList>
  );
}
