type AudioWindow = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };

/** Safari 16.4+ lets a page say what its sound is for, which decides whether silent mode mutes it. */
type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient';
type NavigatorWithSession = Navigator & { audioSession?: { type: AudioSessionType } };

let context: AudioContext | null = null;
let listening = false;
let restoreTimer: ReturnType<typeof setTimeout> | null = null;

export type AlarmSound = 'beeps' | 'bell' | 'chime' | 'rising';

type Note = {
  at: number;
  frequency: number;
  seconds: number;
  wave: OscillatorType;
  /** Glides to this pitch over the note, for the rising sound. */
  to?: number;
  /** Rings out slowly, like a bell. */
  ring?: boolean;
};

/** One play of each sound, and how long it lasts before the next repeat. */
const PATTERNS: Record<AlarmSound, { notes: Note[]; length: number }> = {
  beeps: {
    notes: [0, 0.6, 1.2].flatMap((start) => [
      { at: start, frequency: 1047, seconds: 0.18, wave: 'square' as const },
      { at: start + 0.22, frequency: 1319, seconds: 0.18, wave: 'square' as const },
    ]),
    length: 1.8,
  },
  bell: {
    notes: [
      { at: 0, frequency: 880, seconds: 1.4, wave: 'sine', ring: true },
      { at: 0, frequency: 2428, seconds: 0.9, wave: 'sine', ring: true },
    ],
    length: 1.5,
  },
  chime: {
    notes: [1047, 1319, 1568].map((frequency, i) => ({
      at: i * 0.22,
      frequency,
      seconds: 0.5,
      wave: 'triangle' as const,
      ring: true,
    })),
    length: 1.1,
  },
  rising: {
    notes: [0, 0.55].map((at) => ({
      at,
      frequency: 600,
      to: 1500,
      seconds: 0.45,
      wave: 'square' as const,
    })),
    length: 1.2,
  },
};

export type AlarmOptions = { sound?: AlarmSound; repeats?: number };

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
export function playRestTone(options: AlarmOptions = {}): boolean {
  if (!context || context.state !== 'running') return false;
  const pattern = PATTERNS[options.sound ?? 'beeps'];
  const repeats = Math.min(5, Math.max(1, Math.round(options.repeats ?? 1)));
  setSessionType('playback');
  const now = context.currentTime;
  const out = context.createGain();
  out.gain.setValueAtTime(0.9, now);
  out.connect(context.destination);
  for (let r = 0; r < repeats; r++) {
    for (const note of pattern.notes) {
      playNote(context, out, note, now + r * pattern.length);
    }
  }
  if (restoreTimer !== null) clearTimeout(restoreTimer);
  restoreTimer = setTimeout(
    () => {
      restoreTimer = null;
      setSessionType('ambient');
    },
    (repeats * pattern.length + 0.2) * 1000,
  );
  return true;
}

function playNote(audio: AudioContext, out: GainNode, note: Note, at: number): void {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const end = at + note.seconds;
  oscillator.type = note.wave;
  oscillator.frequency.value = note.frequency;
  if (note.to !== undefined && oscillator.frequency.exponentialRampToValueAtTime) {
    oscillator.frequency.setValueAtTime(note.frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(note.to, end);
  }
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(note.ring ? 0.7 : 0.5, at + 0.01);
  if (!note.ring) gain.gain.setValueAtTime(0.5, end - 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(out);
  oscillator.start(at);
  oscillator.stop(end);
}

export function resetAudioForTests(): void {
  context = null;
  listening = false;
  if (restoreTimer !== null) clearTimeout(restoreTimer);
  restoreTimer = null;
}
