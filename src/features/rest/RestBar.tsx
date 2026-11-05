import { IonButton } from '@ionic/react';
import { useEffect, useRef, useState } from 'react';
import { useData, useLive } from '../../app/DataProvider';
import { extendRestTimer, getRestTimer, skipRestTimer } from '../../data/rest-timer';
import { getSettings } from '../../data/settings';
import { restRemainingMs } from '../../domain/rest';
import { playRestTone } from '../../pwa/audio';

const TONE_WINDOW_MS = 2000;

function formatRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
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
  return (
    <div
      className={over ? 'rest-bar rest-bar-over' : 'rest-bar'}
      role="timer"
      data-testid="rest-bar"
    >
      <span className="rest-bar-time">{over ? 'Rest over' : formatRemaining(remaining)}</span>
      {!over && (
        <IonButton fill="clear" onClick={() => void extendRestTimer(ctx, 15)}>
          +15s
        </IonButton>
      )}
      <IonButton fill="clear" onClick={() => void skipRestTimer(ctx)}>
        {over ? 'Dismiss' : 'Skip'}
      </IonButton>
    </div>
  );
}
