import { IonItem, IonLabel, IonList, IonListHeader } from '@ionic/react';
import { loadStatsData, type StatsData } from '../../data/stats';
import { exerciseCharts } from '../../domain/exercise-series';
import { formatShortDate } from '../../domain/format';
import type { TestResult } from '../../domain/schemas';
import { useLiveWhileShown } from '../../ui/useLiveWhileShown';
import { SpecChart } from './SpecChart';

function testResultLine(result: TestResult): string {
  const hold = result.bestHoldSec === null ? [] : [`${result.bestHoldSec}s`];
  return [formatShortDate(result.date), result.progressionLevel ?? [], hold].flat().join(' · ');
}

function TestResults({ data }: { data: StatsData }) {
  if (data.testResults.length === 0) return null;
  const newestFirst = [...data.testResults].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <IonList inset>
      <IonListHeader>
        <IonLabel>Test results</IonLabel>
      </IonListHeader>
      {newestFirst.map((result) => (
        <IonItem key={result.id}>
          <IonLabel className="ion-text-wrap">
            <h2>{data.exercisesById.get(result.exerciseId)?.name ?? result.exerciseId}</h2>
            <p>{testResultLine(result)}</p>
            {result.note !== '' && <p>{result.note}</p>}
          </IonLabel>
        </IonItem>
      ))}
    </IonList>
  );
}

export default function SkillsContent() {
  const data = useLiveWhileShown(loadStatsData);
  if (!data) return null;

  const skills = [...data.exercisesById.values()]
    .filter((e) => e.trackingType === 'hold' || e.trackingType === 'complex')
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((exercise) => ({ exercise, charts: exerciseCharts({ ...data, exercise }) }))
    .filter((skill) => skill.charts.length > 0);

  if (skills.length === 0 && data.testResults.length === 0) {
    return <p className="empty-note">Holds and complexes will show here once you log them.</p>;
  }
  return (
    <>
      <TestResults data={data} />
      {skills.map(({ exercise, charts }) => (
        <section key={exercise.id}>
          <h2 className="section-heading">{exercise.name}</h2>
          {charts.map((chart) => (
            <SpecChart key={chart.id} spec={chart} />
          ))}
        </section>
      ))}
    </>
  );
}
