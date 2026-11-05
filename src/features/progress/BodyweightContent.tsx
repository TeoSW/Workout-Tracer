import {
  IonButton,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
} from '@ionic/react';
import { useState } from 'react';
import { useData, useLive, useToday } from '../../app/DataProvider';
import { deleteBodyweight, listBodyweight, setBodyweight } from '../../data/bodyweight';
import { parseBodyweight } from '../../domain/bodyweight';
import { isDateStr } from '../../domain/dates';
import { bodyweightChart } from '../../domain/exercise-series';
import { formatChartValue, formatLongDate } from '../../domain/format';
import { ErrorNote, useGuard } from '../../ui/useGuard';
import { SpecChart } from './SpecChart';

export default function BodyweightContent() {
  const ctx = useData();
  const today = useToday();
  const entries = useLive(listBodyweight);
  const [date, setDate] = useState(today);
  const [text, setText] = useState('');
  const { error, guard, setError } = useGuard();
  if (!entries) return null;
  const chart = bodyweightChart(entries);

  function save() {
    const kg = parseBodyweight(text);
    if (kg === null) {
      setError('Enter your weight in kg.');
      return;
    }
    if (!isDateStr(date) || date > today) {
      setError('Pick a date up to today.');
      return;
    }
    void guard(async () => {
      await setBodyweight(ctx, date, kg);
      setText('');
    });
  }

  return (
    <>
      {chart && <SpecChart spec={chart} />}
      <IonList inset>
        <IonListHeader>
          <IonLabel>Add or correct a day</IonLabel>
        </IonListHeader>
        <IonItem>
          <IonInput
            aria-label="Date"
            label="Date"
            type="date"
            value={date}
            max={today}
            onIonInput={(e) => setDate(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            aria-label="Weight"
            label="Weight"
            placeholder="kg"
            inputmode="decimal"
            value={text}
            onIonInput={(e) => setText(e.detail.value ?? '')}
          />
          <IonButton slot="end" fill="clear" onClick={save}>
            Save
          </IonButton>
        </IonItem>
      </IonList>
      <ErrorNote error={error} />
      {entries.length > 0 && (
        <IonList inset>
          {[...entries].reverse().map((entry) => (
            <IonItemSliding key={entry.date}>
              <IonItem
                button
                detail={false}
                onClick={() => {
                  setDate(entry.date);
                  setText(String(entry.kg));
                }}
              >
                <IonLabel>{formatLongDate(entry.date)}</IonLabel>
                <IonNote slot="end">{formatChartValue(entry.kg, 'kg')}</IonNote>
              </IonItem>
              <IonItemOptions side="end">
                <IonItemOption
                  color="danger"
                  onClick={() => void guard(() => deleteBodyweight(ctx, entry.date))}
                >
                  Delete
                </IonItemOption>
              </IonItemOptions>
            </IonItemSliding>
          ))}
        </IonList>
      )}
    </>
  );
}
