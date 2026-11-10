import { IonItem, IonLabel, IonList } from '@ionic/react';
import { isAndroid, isStandalone } from '../../pwa/install';

/** Storage in a browser tab is separate from the installed app, so this stays until they move. */
export function InstallBanner() {
  if (isStandalone()) return null;
  const steps = isAndroid()
    ? 'Open the browser menu, then tap Install app or Add to Home screen. Data saved in this browser tab'
    : 'Tap Share, then Add to Home Screen. Data saved in this Safari tab';
  return (
    <IonList inset>
      <IonItem>
        <IonLabel className="ion-text-wrap notice">
          <h2>Install this app</h2>
          <p>{steps} won't appear in the installed app.</p>
        </IonLabel>
      </IonItem>
    </IonList>
  );
}
