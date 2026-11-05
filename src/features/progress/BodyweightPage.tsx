import { Suspense, lazy } from 'react';
import { PageShell } from '../../ui/PageShell';

const BodyweightContent = lazy(() => import('./BodyweightContent'));

export function BodyweightPage() {
  return (
    <PageShell title="Bodyweight" back="/tabs/progress">
      <Suspense fallback={<p className="empty-note">Loading charts</p>}>
        <BodyweightContent />
      </Suspense>
    </PageShell>
  );
}
