import { IonChip } from '@ionic/react';

/** A row of toggle chips, 44pt tall. */
export function Chips<T>(props: {
  options: readonly T[];
  label: (value: T) => string;
  isOn: (value: T) => boolean;
  onTap: (value: T) => void;
}) {
  return (
    <div className="chip-row">
      {props.options.map((value) => {
        const on = props.isOn(value);
        return (
          <IonChip
            key={props.label(value)}
            color={on ? 'primary' : 'medium'}
            outline={!on}
            aria-pressed={on}
            onClick={() => props.onTap(value)}
          >
            {props.label(value)}
          </IonChip>
        );
      })}
    </div>
  );
}
