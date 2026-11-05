import { Suspense, lazy } from 'react';
import { PageShell } from '../../ui/PageShell';

const SkillsContent = lazy(() => import('./SkillsContent'));

export function SkillsPage() {
  return (
    <PageShell title="Skills" back="/tabs/progress">
      <Suspense fallback={<p className="empty-note">Loading charts</p>}>
        <SkillsContent />
      </Suspense>
    </PageShell>
  );
}
