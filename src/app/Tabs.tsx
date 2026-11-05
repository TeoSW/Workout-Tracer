import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { barbell, barChart, calendar, settings, today } from 'ionicons/icons';
import { Navigate, Route } from 'react-router-dom';
import { HistoryPage } from '../features/history/HistoryPage';
import { SessionEditPage } from '../features/history/SessionEditPage';
import { SessionPage } from '../features/history/SessionPage';
import { ExerciseDetailPage } from '../features/library/ExerciseDetailPage';
import { ExerciseEditPage, ExerciseNewPage } from '../features/library/ExerciseFormPage';
import { LibraryPage } from '../features/library/LibraryPage';
import { AddBlockPage } from '../features/programs/AddBlockPage';
import { BlockEditorPage } from '../features/programs/BlockEditorPage';
import { DayEditorPage } from '../features/programs/DayEditorPage';
import { ImportProgramPage } from '../features/programs/ImportProgramPage';
import { NewProgramPage } from '../features/programs/NewProgramPage';
import { ProgramEditorPage } from '../features/programs/ProgramEditorPage';
import { ProgramsPage } from '../features/programs/ProgramsPage';
import { ShareProgramPage } from '../features/programs/ShareProgramPage';
import { ProgressPage } from '../features/progress/ProgressPage';
import { BandsPage } from '../features/settings/BandsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { PickDayPage } from '../features/today/PickDayPage';
import { RestBar } from '../features/rest/RestBar';
import { TodayPage } from '../features/today/TodayPage';
import { AddExercisePage } from '../features/workout/AddExercisePage';
import { SummaryPage } from '../features/workout/SummaryPage';
import { TestFlowPage } from '../features/workout/TestFlowPage';
import { WorkoutPage } from '../features/workout/WorkoutPage';

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
        <Route path="today/pick-day" element={<PickDayPage />} />
        <Route path="today/workout/add" element={<AddExercisePage />} />
        <Route path="today/workout" element={<WorkoutPage />} />
        <Route path="today/summary/:id" element={<SummaryPage />} />
        <Route path="today/test/:id" element={<TestFlowPage />} />
        <Route path="today" element={<TodayPage />} />
        <Route path="history/:id/edit" element={<SessionEditPage />} />
        <Route path="history/:id" element={<SessionPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="programs/library/new" element={<ExerciseNewPage />} />
        <Route path="programs/library/:exerciseId/edit" element={<ExerciseEditPage />} />
        <Route path="programs/library/:exerciseId" element={<ExerciseDetailPage />} />
        <Route path="programs/library" element={<LibraryPage />} />
        <Route path="programs/new" element={<NewProgramPage />} />
        <Route path="programs/import" element={<ImportProgramPage />} />
        <Route path="programs/:id/share" element={<ShareProgramPage />} />
        <Route path="programs/:id/days/:dayId/blocks/:blockId" element={<BlockEditorPage />} />
        <Route path="programs/:id/days/:dayId/add-choice" element={<AddBlockPage asChoice />} />
        <Route path="programs/:id/days/:dayId/add" element={<AddBlockPage />} />
        <Route path="programs/:id/days/:dayId" element={<DayEditorPage />} />
        <Route path="programs/:id" element={<ProgramEditorPage />} />
        <Route path="programs" element={<ProgramsPage />} />
        <Route path="settings/bands" element={<BandsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route index element={<Navigate to="today" replace />} />
      </IonRouterOutlet>
      <div slot="bottom" className="rest-bar-slot">
        <RestBar />
      </div>
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
