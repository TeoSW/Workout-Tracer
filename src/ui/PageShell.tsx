import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { ReactNode } from 'react';

/**
 * One screen. Root tab pages get the iOS large title; pages opened from a list pass `back`, the
 * route to fall back to when there is no history, and get a normal title with a back button.
 */
export function PageShell(props: {
  title: string;
  back?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { title, back, actions, children } = props;
  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          {back !== undefined && (
            <IonButtons slot="start">
              <IonBackButton defaultHref={back} text="Back" />
            </IonButtons>
          )}
          <IonTitle>{title}</IonTitle>
          {actions && <IonButtons slot="end">{actions}</IonButtons>}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="grouped">
        {back === undefined && (
          <IonHeader collapse="condense">
            <IonToolbar>
              <IonTitle size="large">{title}</IonTitle>
            </IonToolbar>
          </IonHeader>
        )}
        {children}
      </IonContent>
    </IonPage>
  );
}
