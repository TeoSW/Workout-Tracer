import { IonLabel, IonList, IonListHeader } from '@ionic/react';
import type { ReactNode } from 'react';

/** A titled chart with a text line, so no number needs a tap to be read. */
export function ChartCard(props: { title: string; readout: string; children?: ReactNode }) {
  return (
    <IonList inset>
      <IonListHeader>
        <IonLabel>{props.title}</IonLabel>
      </IonListHeader>
      <div className="chart-card">
        <p className="chart-readout">{props.readout}</p>
        {props.children}
      </div>
    </IonList>
  );
}
