import {
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTextarea,
  useIonRouter,
} from '@ionic/react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useData } from '../../app/DataProvider';
import { importProgram, previewImport } from '../../data/share';
import type { ImportPlan } from '../../domain/import';
import { readFileText } from '../../pwa/files';
import { PageShell } from '../../ui/PageShell';

const PROGRAMS = '/tabs/programs';

const countOf = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

export function ImportProgramPage() {
  const ctx = useData();
  const router = useIonRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [source, setSource] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function preview(input: string) {
    const result = await previewImport(ctx, input);
    setPlan(result.ok ? result.plan : null);
    setSource(result.ok ? input : '');
    setError(result.ok ? null : result.error);
  }

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await preview(await readFileText(file));
  }

  async function add() {
    const result = await importProgram(ctx, source);
    if (result.ok) router.push(`${PROGRAMS}/${result.program.id}`, 'forward', 'replace');
    else setError(result.error);
  }

  return (
    <PageShell title="Import program" back={PROGRAMS}>
      <IonList inset>
        <IonItem>
          <IonTextarea
            aria-label="Share code"
            label="Share code"
            labelPlacement="stacked"
            placeholder="WT1."
            rows={4}
            value={text}
            onIonInput={(e) => setText(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem button detail={false} onClick={() => void preview(text)}>
          <IonLabel color="primary">Preview</IonLabel>
        </IonItem>
        <IonItem button detail={false} onClick={() => fileInput.current?.click()}>
          <IonLabel color="primary">Pick a file</IonLabel>
        </IonItem>
      </IonList>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        aria-label="Program file"
        hidden
        onChange={(e) => void pickFile(e)}
      />
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      {plan && (
        <IonList inset>
          <IonListHeader>
            <IonLabel>{plan.program.name}</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel>{countOf(plan.dayTemplates.length, 'day')}</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>New exercises</IonLabel>
            <IonNote slot="end">{plan.newExercises.length}</IonNote>
          </IonItem>
          <IonItem>
            <IonLabel>New bands</IonLabel>
            <IonNote slot="end">{plan.newBands.length}</IonNote>
          </IonItem>
          <IonItem button detail={false} onClick={() => void add()}>
            <IonLabel color="primary">Add program</IonLabel>
          </IonItem>
        </IonList>
      )}
    </PageShell>
  );
}
