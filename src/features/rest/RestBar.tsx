import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonList,
  IonListHeader,
  IonLabel,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useRef, useState } from 'react';
import { useData, useLive } from '../../app/DataProvider';
import {
  extendRestTimer,
  getRestTimer,
  setRestTimerRemaining,
  skipRestTimer,
} from '../../data/rest-timer';
import { Chips } from '../../ui/Chips';
import { Stepper } from '../../ui/Stepper';
import { getSettings } from '../../data/settings';
import { restRemainingMs } from '../../domain/rest';
import { playRestTone } from '../../pwa/audio';

const TONE_WINDOW_MS = 2000;
const PRESETS = [30, 60, 90, 120, 150, 180, 240, 300];

function formatRemaining(msOrSeconds: number, inSeconds = false): string {
  const seconds = inSeconds ? msOrSeconds : Math.ceil(msOrSeconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Pinned above the tab bar on every tab. The time comes from the stored end time on each tick,
 * so it is right after the phone sleeps or the app reloads, and timers in the background cannot
 * make it drift.
 */
export function RestBar() {
  const ctx = useData();
  const timer = useLive(getRestTimer);
  const settings = useLive(getSettings);
  const [now, setNow] = useState(() => ctx.clock.now());
  const announced = useRef<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [custom, setCustom] = useState(120);
  const sound = settings?.sound ?? false;

  const remaining = timer ? restRemainingMs(timer, now) : null;
  const over = remaining === 0;

  useEffect(() => {
    if (!timer || over) return undefined;
    setNow(ctx.clock.now());
    const tick = setInterval(() => setNow(ctx.clock.now()), 250);
    const onVisible = () => setNow(ctx.clock.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [ctx, timer, over]);

  useEffect(() => {
    if (!over || !timer || announced.current === timer.endsAt) return;
    announced.current = timer.endsAt;
    // Coming back long after rest ended shows Rest over, without a sound.
    const justEnded = ctx.clock.now() - timer.endsAt < TONE_WINDOW_MS;
    if (sound && justEnded && document.visibilityState === 'visible') playRestTone();
  }, [ctx, over, timer, sound]);

  if (!timer || remaining === null) return null;

  function openChooser() {
    if (remaining === null) return;
    setCustom(Math.max(15, Math.round(remaining / 15000) * 15));
    setChoosing(true);
  }

  function choose(seconds: number) {
    setChoosing(false);
    void setRestTimerRemaining(ctx, seconds);
  }

  return (
    <div
      className={over ? 'rest-bar rest-bar-over' : 'rest-bar'}
      role="timer"
      data-testid="rest-bar"
    >
      <div
        className="rest-bar-main"
        role="button"
        tabIndex={0}
        aria-label="Change rest time"
        onClick={openChooser}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openChooser();
          }
        }}
      >
        <span className="rest-bar-label">Rest</span>
        <span className="rest-bar-time">{over ? 'Rest over' : formatRemaining(remaining)}</span>
        <span
          className="rest-bar-progress"
          aria-hidden="true"
          style={{
            transform: `scaleX(${over ? 0 : remaining / Math.max(1, timer.durationSec * 1000)})`,
          }}
        />
      </div>
      {!over && (
        <>
          <IonButton fill="clear" onClick={() => void extendRestTimer(ctx, -15)}>
            -15s
          </IonButton>
          <IonButton fill="clear" onClick={() => void extendRestTimer(ctx, 15)}>
            +15s
          </IonButton>
        </>
      )}
      <IonButton fill="clear" onClick={() => void skipRestTimer(ctx)}>
        {over ? 'Dismiss' : 'Skip'}
      </IonButton>
      <IonModal
        isOpen={choosing}
        breakpoints={[0, 0.55]}
        initialBreakpoint={0.55}
        onDidDismiss={() => setChoosing(false)}
      >
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => setChoosing(false)}>Cancel</IonButton>
            </IonButtons>
            <IonTitle>Rest time</IonTitle>
            <IonButtons slot="end">
              <IonButton strong onClick={() => choose(custom)}>
                Set
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList inset>
            <IonListHeader>
              <IonLabel>Rest from now</IonLabel>
            </IonListHeader>
            <Chips
              options={PRESETS}
              label={(s) => formatRemaining(s, true)}
              isOn={() => false}
              onTap={(s) => choose(s)}
            />
            <Stepper
              label="Custom"
              noun="seconds"
              unit="s"
              step={15}
              min={15}
              max={900}
              value={custom}
              onChange={setCustom}
            />
          </IonList>
        </IonContent>
      </IonModal>
    </div>
  );
}
