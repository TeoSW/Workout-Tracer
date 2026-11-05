import { IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/react';
import { useToday } from '../../app/DataProvider';
import { loadStatsData, type StatsData } from '../../data/stats';
import { recentPrs } from '../../domain/exercise-series';
import { formatPr, formatShortDate } from '../../domain/format';
import { useLiveWhileShown } from '../../ui/useLiveWhileShown';
import { ConsistencySection } from './ConsistencySection';
import { MuscleSection } from './MuscleSection';

const RECENT_PRS = 5;

function RecentPrs({ data }: { data: StatsData }) {
  const prs = recentPrs({ ...data, limit: RECENT_PRS });
  if (prs.length === 0) return null;
  return (
    <IonList inset>
      <IonListHeader>
        <IonLabel>Recent PRs</IonLabel>
      </IonListHeader>
      {prs.map((pr) => {
        const exercise = data.exercisesById.get(pr.exerciseId);
        if (!exercise) return null;
        return (
          <IonItem
            key={`${pr.sessionId}-${pr.exerciseId}-${pr.kind}-${pr.key}`}
            routerLink={`/tabs/history/${pr.sessionId}`}
            detail
          >
            <IonLabel className="ion-text-wrap">{formatPr(pr, exercise)}</IonLabel>
            <IonNote slot="end">{formatShortDate(pr.date)}</IonNote>
          </IonItem>
        );
      })}
    </IonList>
  );
}

export default function ProgressContent() {
  const today = useToday();
  const data = useLiveWhileShown(loadStatsData);
  if (!data) return null;
  const hasWorkouts = data.sessions.length > 0;

  return (
    <>
      {!hasWorkouts && <p className="empty-note">Stats will show here once you log workouts.</p>}
      {hasWorkouts && (
        <ConsistencySection sessions={data.sessions} program={data.program} today={today} />
      )}
      {hasWorkouts && <MuscleSection data={data} today={today} />}
      {hasWorkouts && <RecentPrs data={data} />}
      <IonList inset>
        <IonItem routerLink="/tabs/progress/bodyweight" detail>
          <IonLabel>Bodyweight</IonLabel>
        </IonItem>
        <IonItem routerLink="/tabs/progress/skills" detail>
          <IonLabel>Skills</IonLabel>
        </IonItem>
        <IonItem routerLink="/tabs/progress/exercises" detail>
          <IonLabel>Exercises</IonLabel>
        </IonItem>
      </IonList>
    </>
  );
}
