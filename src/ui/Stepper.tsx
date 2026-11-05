import { IonButton, IonIcon, IonItem, IonLabel } from '@ionic/react';
import { add, remove } from 'ionicons/icons';

/** A labelled number with minus and plus buttons. */
export function Stepper(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  /** Plural noun for the button labels, when it differs from the lowercased label. */
  noun?: string;
}) {
  const { label, value, onChange, step = 1, min = 0, max = Number.MAX_SAFE_INTEGER, unit } = props;
  const noun = props.noun ?? label.toLowerCase();
  return (
    <IonItem>
      <IonLabel>{label}</IonLabel>
      <IonButton
        slot="end"
        fill="clear"
        aria-label={`Fewer ${noun}`}
        disabled={value - step < min}
        onClick={() => onChange(value - step)}
      >
        <IonIcon slot="icon-only" icon={remove} aria-hidden="true" />
      </IonButton>
      <span slot="end">
        {value}
        {unit}
      </span>
      <IonButton
        slot="end"
        fill="clear"
        aria-label={`More ${noun}`}
        disabled={value + step > max}
        onClick={() => onChange(value + step)}
      >
        <IonIcon slot="icon-only" icon={add} aria-hidden="true" />
      </IonButton>
    </IonItem>
  );
}
