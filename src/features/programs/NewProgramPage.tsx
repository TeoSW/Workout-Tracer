import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSelect,
  IonSelectOption,
  useIonRouter,
} from '@ionic/react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useData } from '../../app/DataProvider';
import { createProgramFromTemplate } from '../../data/programs';
import { BUILT_IN_TEMPLATES, blankTemplate } from '../../domain/fixtures/templates';
import { presetSummary } from '../../domain/preset-summary';
import { SPLIT_TYPES, type SplitType } from '../../domain/schemas';
import { SPLIT_LABELS } from '../../ui/labels';
import { PageShell } from '../../ui/PageShell';
import { ErrorNote, useGuard } from '../../ui/useGuard';

/** Presets first, since most people start from one. A blank program sits at the bottom. */
export function NewProgramPage() {
  const ctx = useData();
  const router = useIonRouter();
  const clientId = new URLSearchParams(useLocation().search).get('client');
  const clientQuery = clientId ? `?client=${clientId}` : '';
  const [splitType, setSplitType] = useState<SplitType>('custom');
  const [name, setName] = useState('');
  const { error, guard, setError } = useGuard();

  function createBlank() {
    if (name.trim() === '') {
      setError('Give the program a name.');
      return;
    }
    void guard(async () => {
      const { program } = await createProgramFromTemplate(
        ctx,
        blankTemplate(splitType),
        name.trim(),
        clientId ? { clientId } : {},
      );
      router.push(`/tabs/programs/${program.id}`, 'forward', 'replace');
    });
  }

  return (
    <PageShell title="New program" back="/tabs/programs">
      <IonList inset data-testid="preset-list">
        <IonListHeader>
          <IonLabel>Presets</IonLabel>
        </IonListHeader>
        {BUILT_IN_TEMPLATES.map((t) => (
          <IonItem key={t.id} routerLink={`/tabs/programs/presets/${t.id}${clientQuery}`} detail>
            <IonLabel>
              <h2>{t.name}</h2>
              <p>{presetSummary(t)}</p>
            </IonLabel>
          </IonItem>
        ))}
      </IonList>
      <IonList inset>
        <IonListHeader>
          <IonLabel>Blank program</IonLabel>
        </IonListHeader>
        <IonItem>
          <IonSelect
            aria-label="Split"
            label="Split"
            interface="action-sheet"
            value={splitType}
            onIonChange={(e) => setSplitType(e.detail.value)}
          >
            {SPLIT_TYPES.map((s) => (
              <IonSelectOption key={s} value={s}>
                {SPLIT_LABELS[s]}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonInput
            aria-label="Program name"
            label="Name"
            value={name}
            onIonInput={(e) => setName(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem button detail={false} onClick={createBlank}>
          <IonLabel color="primary">Create blank program</IonLabel>
        </IonItem>
      </IonList>
      <ErrorNote error={error} />
      <div className="ion-padding">
        <IonButton expand="block" fill="clear" routerLink="/tabs/programs/import">
          Import a program from a friend
        </IonButton>
      </div>
    </PageShell>
  );
}
