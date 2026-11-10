type AudioWindow = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };

/** Safari 16.4+ lets a page say what its sound is for, which decides whether silent mode mutes it. */
type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient';
type NavigatorWithSession = Navigator & { audioSession?: { type: AudioSessionType } };

let context: AudioContext | null = null;
let listening = false;
let restoreTimer: ReturnType<typeof setTimeout> | null = null;

/** Three double beeps: high, then higher. Loud enough to hear across a gym. */
const BEEPS: readonly { at: number; frequency: number }[] = [0, 0.6, 1.2].flatMap((start) => [
  { at: start, frequency: 1047 },
  { at: start + 0.22, frequency: 1319 },
]);
const BEEP_SECONDS = 0.18;
const ALARM_SECONDS = 1.6;

function audioSession(): { type: AudioSessionType } | undefined {
  return (navigator as NavigatorWithSession).audioSession;
}

function setSessionType(type: AudioSessionType): void {
  const session = audioSession();
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // An older Safari without the setter keeps its default.
  }
}

/** iOS can suspend the sound after the app was in the background. Any tap wakes it again. */
function wake(): void {
  if (context && context.state !== 'running') void context.resume().catch(() => undefined);
}

/** iOS plays audio only after a tap has started it, so this runs from a tap. */
export function unlockAudio(): void {
  const scope = globalThis as unknown as AudioWindow;
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Context) return;
  // Mix with music while nothing is playing, so starting a workout doesn't stop a playlist.
  if (context === null) setSessionType('ambient');
  context ??= new Context();
  void context.resume().catch(() => undefined);
  if (!listening) {
    listening = true;
    document.addEventListener('pointerdown', wake, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') wake();
    });
  }
}

/**
 * The rest alarm. For its length the sound is played as media, which iOS doesn't mute in
 * silent mode, then the page goes back to mixing with other audio. Returns false when audio
 * is not unlocked or not available.
 */
export function playRestTone(): boolean {
  if (!context || context.state !== 'running') return false;
  setSessionType('playback');
  const now = context.currentTime;
  const out = context.createGain();
  out.gain.setValueAtTime(0.9, now);
  out.connect(context.destination);
  for (const beep of BEEPS) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + beep.at;
    oscillator.type = 'square';
    oscillator.frequency.value = beep.frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.01);
    gain.gain.setValueAtTime(0.5, start + BEEP_SECONDS - 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + BEEP_SECONDS);
    oscillator.connect(gain);
    gain.connect(out);
    oscillator.start(start);
    oscillator.stop(start + BEEP_SECONDS);
  }
  if (restoreTimer !== null) clearTimeout(restoreTimer);
  restoreTimer = setTimeout(() => {
    restoreTimer = null;
    setSessionType('ambient');
  }, ALARM_SECONDS * 1000);
  return true;
}

export function resetAudioForTests(): void {
  context = null;
  listening = false;
  if (restoreTimer !== null) clearTimeout(restoreTimer);
  restoreTimer = null;
}
