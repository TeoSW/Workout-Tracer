import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { barbell, barChart, calendar, settings, today } from 'ionicons/icons';
import { Navigate, Route } from 'react-router-dom';
import { HistoryPage } from '../features/history/HistoryPage';
import { ProgramsPage } from '../features/programs/ProgramsPage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { TodayPage } from '../features/today/TodayPage';

const TABS = [
  { tab: 'today', label: 'Today', icon: today },
  { tab: 'history', label: 'History', icon: calendar },
  { tab: 'progress', label: 'Progress', icon: barChart },
  { tab: 'programs', label: 'Programs', icon: barbell },
  { tab: 'settings', label: 'Settings', icon: settings },
];

export function Tabs() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="today" element={<TodayPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="programs" element={<ProgramsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route index element={<Navigate to="today" replace />} />
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        {TABS.map(({ tab, label, icon }) => (
          <IonTabButton key={tab} tab={tab} href={`/tabs/${tab}`}>
            <IonIcon icon={icon} aria-hidden="true" />
            <IonLabel>{label}</IonLabel>
          </IonTabButton>
        ))}
      </IonTabBar>
    </IonTabs>
  );
}
