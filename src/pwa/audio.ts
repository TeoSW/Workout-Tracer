type AudioWindow = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;

/** iOS plays audio only after a tap has started it, so this runs from a tap. */
export function unlockAudio(): void {
  const scope = globalThis as unknown as AudioWindow;
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Context) return;
  context ??= new Context();
  void context.resume();
}

/** One short tone. Returns false when audio is not unlocked or not available. */
export function playRestTone(): boolean {
  if (!context || context.state !== 'running') return false;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.4);
  return true;
}

export function resetAudioForTests(): void {
  context = null;
}
