import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactHashRouter } from '@ionic/react-router';
import { Navigate, Route } from 'react-router-dom';
import type { DataContext } from '../data/context';
import { DataProvider } from './DataProvider';
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
  return (
    <DataProvider ctx={ctx}>
      <IonApp>
        <IonReactHashRouter>
          <IonRouterOutlet>
            <Route path="/tabs/*" element={<Tabs />} />
            <Route path="/" element={<Navigate to="/tabs/today" replace />} />
          </IonRouterOutlet>
        </IonReactHashRouter>
        <UpdateToast />
      </IonApp>
    </DataProvider>
  );
}
