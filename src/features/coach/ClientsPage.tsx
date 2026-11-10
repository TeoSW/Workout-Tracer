import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useState } from 'react';
import { useData, useLive } from '../../app/DataProvider';
import { addClient, archiveClient, listClients } from '../../data/clients';
import { PageShell } from '../../ui/PageShell';
import { SwipeToDelete } from '../../ui/SwipeToDelete';
import { ErrorNote, useGuard } from '../../ui/useGuard';

/** The coach's home: every client, and a button to add one. */
export function ClientsPage() {
  const ctx = useData();
  const clients = useLive(listClients);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const { error, guard } = useGuard();

  function close() {
    setAdding(false);
    setName('');
    setNote('');
  }

  return (
    <PageShell
      title="Clients"
      actions={
        <IonButton aria-label="Add client" onClick={() => setAdding(true)}>
          <IonIcon slot="icon-only" icon={add} aria-hidden="true" />
        </IonButton>
      }
    >
      {clients?.length === 0 && (
        <p className="empty-note">Add a client, then build and send their program.</p>
      )}
      {clients && clients.length > 0 && (
        <IonList inset>
          {clients.map((c) => (
            <SwipeToDelete
              key={c.id}
              label={c.name}
              header={`Remove ${c.name}?`}
              message="They leave the list. Their programs stay under Programs."
              onDelete={() => archiveClient(ctx, c.id)}
            >
              <IonItem routerLink={`/tabs/clients/${c.id}`} detail>
                <IonLabel>
                  <h2>{c.name}</h2>
                  {c.note !== '' && <p>{c.note}</p>}
                </IonLabel>
              </IonItem>
            </SwipeToDelete>
          ))}
        </IonList>
      )}
      <IonList inset>
        <IonItem button detail={false} onClick={() => setAdding(true)}>
          <IonLabel color="primary">Add client</IonLabel>
        </IonItem>
      </IonList>
      <ErrorNote error={error} />

      <IonModal
        isOpen={adding}
        breakpoints={[0, 0.6, 1]}
        initialBreakpoint={0.6}
        onDidDismiss={close}
      >
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={close}>Cancel</IonButton>
            </IonButtons>
            <IonTitle>New client</IonTitle>
            <IonButtons slot="end">
              <IonButton
                strong
                onClick={() =>
                  void guard(async () => {
                    await addClient(ctx, { name, note });
                    close();
                  })
                }
              >
                Add
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList inset>
            <IonItem>
              <IonInput
                aria-label="Client name"
                label="Name"
                value={name}
                onIonInput={(e) => setName(e.detail.value ?? '')}
              />
            </IonItem>
            <IonItem>
              <IonTextarea
                aria-label="Client note"
                label="Note"
                labelPlacement="stacked"
                placeholder="Goals, injuries, equipment"
                autoGrow
                value={note}
                onIonInput={(e) => setNote(e.detail.value ?? '')}
              />
            </IonItem>
          </IonList>
          <ErrorNote error={error} />
        </IonContent>
      </IonModal>
    </PageShell>
  );
}
