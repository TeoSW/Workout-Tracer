import {
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTextarea,
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import { getClient, updateClient } from '../../data/clients';
import type { DataContext } from '../../data/context';
import { sentStatus, type SentStatus } from '../../data/programs';
import { shareProgram } from '../../data/share';
import { dateOfEpochMs } from '../../domain/dates';
import { formatDateWithYear } from '../../domain/format';
import { PageShell } from '../../ui/PageShell';
import { SaveButton } from '../../ui/SaveButton';
import { ErrorNote, useGuard } from '../../ui/useGuard';

const CLIENTS = '/tabs/clients';

async function loadClient(ctx: DataContext, id: string) {
  const loaded = await getClient(ctx, id);
  if (!loaded) return null;
  const programs = await Promise.all(
    loaded.programs.map(async (program) => ({
      program,
      // Only a sent program needs its code rebuilt, to see whether it changed since.
      status:
        program.sentAt === undefined || program.sentAt === null
          ? ('not_sent' as const)
          : sentStatus(program, (await shareProgram(ctx, program.id)).code),
    })),
  );
  return { client: loaded.client, programs };
}

function statusText(status: SentStatus, sentAt: number | null | undefined): string {
  if (status === 'not_sent' || sentAt === null || sentAt === undefined) return 'Not sent yet';
  const when = formatDateWithYear(dateOfEpochMs(sentAt));
  return status === 'changed' ? `Changed since sent on ${when}` : `Sent ${when}`;
}

/** One client: their details and the programs written for them. */
export function ClientPage() {
  const { id = '' } = useParams();
  const ctx = useData();
  const data = useLive((c) => loadClient(c, id), [id]);
  const { error, guard } = useGuard();

  if (!data) {
    return (
      <PageShell title="Client" back={CLIENTS}>
        {data === null && <p className="empty-note">This client no longer exists.</p>}
      </PageShell>
    );
  }
  const { client, programs } = data;

  return (
    <PageShell
      title={client.name}
      back={CLIENTS}
      actions={<SaveButton back={CLIENTS} error={error} />}
    >
      <IonList inset>
        <IonItem>
          <IonInput
            aria-label="Client name"
            label="Name"
            value={client.name}
            onIonChange={(e) =>
              void guard(() => updateClient(ctx, id, { name: e.detail.value ?? '' }))
            }
          />
        </IonItem>
        <IonItem>
          <IonTextarea
            aria-label="Client note"
            label="Note"
            labelPlacement="stacked"
            autoGrow
            value={client.note}
            onIonChange={(e) =>
              void guard(() => updateClient(ctx, id, { note: e.detail.value ?? '' }))
            }
          />
        </IonItem>
      </IonList>
      <ErrorNote error={error} />

      <IonList inset data-testid="client-programs">
        <IonListHeader>
          <IonLabel>Programs</IonLabel>
        </IonListHeader>
        {programs.map(({ program, status }) => (
          <IonItem key={program.id} routerLink={`/tabs/programs/${program.id}`} detail>
            <IonLabel>
              <h2>{program.name}</h2>
              <p className={status === 'changed' ? 'sent-changed' : undefined}>
                {statusText(status, program.sentAt)}
              </p>
            </IonLabel>
          </IonItem>
        ))}
        {programs.length === 0 && (
          <IonItem>
            <IonNote>No programs yet.</IonNote>
          </IonItem>
        )}
        <IonItem routerLink={`/tabs/programs/new?client=${id}`} detail>
          <IonLabel color="primary">{`New program for ${client.name}`}</IonLabel>
        </IonItem>
      </IonList>
    </PageShell>
  );
}
