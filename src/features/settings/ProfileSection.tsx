import { IonLabel, IonList, IonListHeader, IonSegment, IonSegmentButton } from '@ionic/react';
import { useState } from 'react';
import { useData } from '../../app/DataProvider';
import type { Profile } from '../../domain/schemas';
import { setStoredProfile } from '../../pwa/profile';
import { reloadApp } from '../../pwa/reload';
import { useConfirm } from '../../ui/useConfirm';

const LABELS: Record<Profile, string> = { me: 'My training', coach: 'Coach' };

/** Switches between your own training and the coach profile. Each keeps its own data. */
export function ProfileSection() {
  const ctx = useData();
  const confirm = useConfirm();
  // The segment keeps its own value, so it is remounted to show the profile in use again.
  const [resetKey, setResetKey] = useState(0);

  async function switchTo(profile: Profile) {
    if (profile === ctx.profile) return;
    const yes = await confirm({
      header: profile === 'coach' ? 'Switch to the coach profile?' : 'Switch to My training?',
      message: 'The app reloads. Each profile keeps its own data, so nothing is lost.',
      confirm: 'Switch',
    });
    if (!yes) {
      setResetKey((k) => k + 1);
      return;
    }
    setStoredProfile(profile);
    reloadApp();
  }

  return (
    <IonList inset>
      <IonListHeader>
        <IonLabel>Profile</IonLabel>
      </IonListHeader>
      <div className="profile-switch">
        <IonSegment
          key={resetKey}
          aria-label="Profile"
          value={ctx.profile}
          onIonChange={(e) => void switchTo(e.detail.value as Profile)}
        >
          {(['me', 'coach'] as const).map((p) => (
            <IonSegmentButton key={p} value={p}>
              <IonLabel>{LABELS[p]}</IonLabel>
            </IonSegmentButton>
          ))}
        </IonSegment>
      </div>
      <p className="section-note profile-note">
        {ctx.profile === 'coach'
          ? 'Coach: add clients, build their programs and send them by WhatsApp or as a file.'
          : 'My training: your own programs, workouts and stats.'}
      </p>
    </IonList>
  );
}
