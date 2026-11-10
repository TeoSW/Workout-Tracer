import { IonBadge, IonButton, IonIcon, IonItem, IonLabel, IonList } from '@ionic/react';
import { add } from 'ionicons/icons';
import { useData, useLive } from '../../app/DataProvider';
import { deleteProgram, listPrograms } from '../../data/programs';
import { SPLIT_LABELS } from '../../ui/labels';
import { PageShell } from '../../ui/PageShell';
import { SwipeToDelete } from '../../ui/SwipeToDelete';

export function ProgramsPage() {
  const ctx = useData();
  const programs = useLive(listPrograms);
  const clients = useLive(
    async (c) => new Map((await c.db.clients.toArray()).map((x) => [x.id, x.name])),
  );

  return (
    <PageShell
      title="Programs"
      actions={
        <IonButton routerLink="/tabs/programs/new" aria-label="New program">
          <IonIcon slot="icon-only" icon={add} aria-hidden="true" />
        </IonButton>
      }
    >
      {programs?.length === 0 && <p className="empty-note">No programs yet.</p>}
      {programs && programs.length > 0 && (
        <IonList inset>
          {programs.map((p) => (
            <SwipeToDelete
              key={p.id}
              label={p.name}
              header={`Delete ${p.name}?`}
              message="Past workouts stay in History."
              onDelete={() => deleteProgram(ctx, p.id)}
            >
              <IonItem routerLink={`/tabs/programs/${p.id}`} detail>
                <IonLabel>
                  <h2>{p.name}</h2>
                  <p>
                    {p.clientId && clients?.get(p.clientId)
                      ? `For ${clients.get(p.clientId)}`
                      : SPLIT_LABELS[p.splitType]}
                  </p>
                </IonLabel>
                {p.active && (
                  <IonBadge slot="end" color="success">
                    Active
                  </IonBadge>
                )}
              </IonItem>
            </SwipeToDelete>
          ))}
        </IonList>
      )}
      <IonList inset>
        <IonItem routerLink="/tabs/programs/new" detail>
          <IonLabel>New program</IonLabel>
        </IonItem>
        <IonItem routerLink="/tabs/programs/import" detail>
          <IonLabel>Import program</IonLabel>
        </IonItem>
        <IonItem routerLink="/tabs/programs/library" detail>
          <IonLabel>Exercises</IonLabel>
        </IonItem>
      </IonList>
    </PageShell>
  );
}
