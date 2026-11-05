import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSelect,
  IonSelectOption,
  useIonRouter,
} from '@ionic/react';
import { checkmark } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { useData } from '../../app/DataProvider';
import { createProgramFromTemplate } from '../../data/programs';
import { templatesForSplit } from '../../domain/fixtures/templates';
import { SPLIT_TYPES, type SplitType } from '../../domain/schemas';
import { SPLIT_LABELS } from '../../ui/labels';
import { PageShell } from '../../ui/PageShell';

export function NewProgramPage() {
  const ctx = useData();
  const router = useIonRouter();
  const [splitType, setSplitType] = useState<SplitType>('custom');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const templates = useMemo(() => templatesForSplit(splitType), [splitType]);

  function pickTemplate(id: string, templateName: string) {
    setTemplateId(id);
    setName(templateName === 'Blank' ? '' : templateName);
    setError(null);
  }

  async function create() {
    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      setError('Pick a template.');
      return;
    }
    if (name.trim() === '') {
      setError('Give the program a name.');
      return;
    }
    const { program } = await createProgramFromTemplate(ctx, template, name.trim());
    router.push(`/tabs/programs/${program.id}`, 'forward', 'replace');
  }

  return (
    <PageShell
      title="New program"
      back="/tabs/programs"
      actions={
        <IonButton strong onClick={() => void create()}>
          Create
        </IonButton>
      }
    >
      <IonList inset>
        <IonItem>
          <IonSelect
            aria-label="Split"
            label="Split"
            interface="action-sheet"
            value={splitType}
            onIonChange={(e) => {
              setSplitType(e.detail.value);
              setTemplateId(null);
            }}
          >
            {SPLIT_TYPES.map((s) => (
              <IonSelectOption key={s} value={s}>
                {SPLIT_LABELS[s]}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </IonList>
      <IonList inset data-testid="template-list">
        <IonListHeader>
          <IonLabel>Template</IonLabel>
        </IonListHeader>
        {templates.map((t) => (
          <IonItem key={t.id} button detail={false} onClick={() => pickTemplate(t.id, t.name)}>
            <IonLabel>{t.name}</IonLabel>
            {t.id === templateId && <IonIcon slot="end" icon={checkmark} aria-label="Selected" />}
          </IonItem>
        ))}
      </IonList>
      <IonList inset>
        <IonItem>
          <IonInput
            aria-label="Program name"
            label="Name"
            value={name}
            onIonInput={(e) => setName(e.detail.value ?? '')}
          />
        </IonItem>
      </IonList>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
    </PageShell>
  );
}
