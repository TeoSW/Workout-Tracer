import { Suspense, lazy } from 'react';
import { PageShell } from '../../ui/PageShell';

// Charts load with this section, so they never slow down the first screen of the app.
const ProgressContent = lazy(() => import('./ProgressContent'));

export function ProgressPage() {
  return (
    <PageShell title="Progress">
      <Suspense fallback={<p className="empty-note">Loading charts</p>}>
        <ProgressContent />
      </Suspense>
    </PageShell>
  );
}
