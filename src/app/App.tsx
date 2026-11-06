import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactHashRouter } from '@ionic/react-router';
import { useEffect } from 'react';
import { Navigate, Route } from 'react-router-dom';
import type { DataContext } from '../data/context';
import { requestPersistentStorage } from '../pwa/storage';
import { useAppUpdate } from '../pwa/useAppUpdate';
import { DataProvider } from './DataProvider';
import { ErrorBoundary } from './ErrorBoundary';
import { Tabs } from './Tabs';
import { UpdateToast } from './UpdateToast';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/palettes/dark.system.css';
import './theme.css';

setupIonicReact({ mode: 'ios' });

export function App({ ctx }: { ctx: DataContext }) {
  useEffect(() => void requestPersistentStorage(), []);
  // Up here so that a crash below can still reach a waiting fix.
  const update = useAppUpdate();

  return (
    <ErrorBoundary ctx={ctx} update={update}>
      <DataProvider ctx={ctx}>
        <IonApp>
          <IonReactHashRouter>
            <IonRouterOutlet>
              <Route path="/tabs/*" element={<Tabs />} />
              <Route path="/" element={<Navigate to="/tabs/today" replace />} />
            </IonRouterOutlet>
          </IonReactHashRouter>
          <UpdateToast update={update} />
        </IonApp>
      </DataProvider>
    </ErrorBoundary>
  );
}
