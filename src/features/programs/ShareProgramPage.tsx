import { IonItem, IonLabel, IonList } from '@ionic/react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLive } from '../../app/DataProvider';
import { shareProgram } from '../../data/share';
import { copyText, saveFile } from '../../pwa/files';
import { PageShell } from '../../ui/PageShell';

function fileName(programName: string): string {
  const safe = programName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${safe || 'program'}.workout-program.json`;
}

export function ShareProgramPage() {
  const { id = '' } = useParams();
  const shared = useLive((c) => shareProgram(c, id), [id]);
  const [message, setMessage] = useState<string | null>(null);
  const back = `/tabs/programs/${id}`;

  if (!shared) return <PageShell title="Share program" back={back} children={null} />;

  async function copy() {
    if (!shared) return;
    setMessage((await copyText(shared.code)) ? 'Code copied.' : 'Select the code and copy it.');
  }

  async function shareFile() {
    if (!shared) return;
    const json = JSON.stringify(shared.share);
    const result = await saveFile(fileName(shared.share.program.name), json, 'application/json');
    if (result === 'saved') setMessage('Program file saved.');
  }

  return (
    <PageShell title="Share program" back={back}>
      <p className="section-note ion-padding-top">
        Send the code or the file to a friend. They paste it under Import program. It has the days
        and exercises, and none of your workouts.
      </p>
      <IonList inset>
        <IonItem button detail={false} onClick={() => void copy()}>
          <IonLabel color="primary">Copy code</IonLabel>
        </IonItem>
        <IonItem button detail={false} onClick={() => void shareFile()}>
          <IonLabel color="primary">Share as file</IonLabel>
        </IonItem>
      </IonList>
      {message && (
        <p className="section-note" role="status">
          {message}
        </p>
      )}
      <p className="share-code">{shared.code}</p>
    </PageShell>
  );
}
