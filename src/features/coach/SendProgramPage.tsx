import { IonButton, IonItem, IonLabel, IonList, IonListHeader } from '@ionic/react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import type { DataContext } from '../../data/context';
import { getClient } from '../../data/clients';
import { getProgram, markProgramSent } from '../../data/programs';
import { shareProgram } from '../../data/share';
import { APP_NAME } from '../../domain/config';
import { saveFile, shareText } from '../../pwa/files';
import { PageShell } from '../../ui/PageShell';

async function loadSend(ctx: DataContext, id: string) {
  const loaded = await getProgram(ctx, id);
  if (!loaded) return null;
  const clientId = loaded.program.clientId;
  const client = clientId ? ((await getClient(ctx, clientId))?.client ?? null) : null;
  const shared = await shareProgram(ctx, id);
  return { program: loaded.program, client, ...shared };
}

/** The message a client gets: what it is, where to paste it, and the code. */
export function clientMessage(clientName: string | null, programName: string, code: string) {
  const hello = clientName ? `Hi ${clientName}, here` : 'Here';
  return `${hello} is your program "${programName}". In ${APP_NAME}, go to Programs, Import program, and paste this code:\n\n${code}`;
}

function fileName(programName: string): string {
  const safe = programName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return `${safe || 'program'}.workout-program.json`;
}

/** Sends a program to its client: as a message for WhatsApp, or as a file. */
export function SendProgramPage() {
  const { id = '' } = useParams();
  const ctx = useData();
  const data = useLive((c) => loadSend(c, id), [id]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const back = `/tabs/programs/${id}`;

  if (!data) return <PageShell title="Send program" back={back} children={null} />;
  const { program, client, code, share } = data;
  const text = clientMessage(client?.name ?? null, program.name, code);
  const who = client?.name ?? 'your client';

  async function run(action: () => Promise<boolean>) {
    if (busy) return;
    setBusy(true);
    try {
      if (await action()) await markProgramSent(ctx, id, code);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title={`Send to ${who}`} back={back}>
      <p className="section-note ion-padding-top">
        {`${who} needs ${APP_NAME} installed. They paste the code under Programs, Import program. Your notes about them are not included.`}
      </p>
      <IonList inset>
        <IonListHeader>
          <IonLabel>Message</IonLabel>
        </IonListHeader>
        <IonItem>
          <IonLabel className="ion-text-wrap send-preview">{text}</IonLabel>
        </IonItem>
      </IonList>
      <div className="ion-padding">
        <IonButton
          expand="block"
          size="large"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const result = await shareText(text);
              if (result === 'copied') {
                setMessage('Message copied. Paste it in WhatsApp, then tap Mark as sent.');
                setCopied(true);
              }
              if (result === 'shared') setMessage(`Sent to ${who}.`);
              if (result === 'failed') setMessage('The message could not be shared. Try the file.');
              return result === 'shared';
            })
          }
        >
          Send message
        </IonButton>
        <IonButton
          expand="block"
          fill="clear"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const saved =
                (await saveFile(
                  fileName(program.name),
                  JSON.stringify(share),
                  'application/json',
                )) === 'saved';
              if (saved) setMessage(`File ready for ${who}.`);
              return saved;
            })
          }
        >
          Send as a file
        </IonButton>
        {copied && (
          <IonButton
            expand="block"
            fill="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setCopied(false);
                setMessage(`Marked as sent to ${who}.`);
                return true;
              })
            }
          >
            Mark as sent
          </IonButton>
        )}
      </div>
      {message && (
        <p className="section-note" role="status">
          {message}
        </p>
      )}
    </PageShell>
  );
}
