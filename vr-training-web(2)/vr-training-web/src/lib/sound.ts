let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedContext) {
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    sharedContext = new AudioContextCtor();
  }
  return sharedContext;
}

function playTone(frequency: number, durationSeconds: number, gainValue: number) {
  const ctx = getContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.frequency.value = frequency;
  gain.gain.value = gainValue;

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + durationSeconds);
}

/**
 * Previously the "Sound effects" toggle in Settings only ever wrote a
 * boolean to localStorage - nothing in the app actually created or played
 * any audio, so the setting had no observable effect. These two short
 * tones (via the Web Audio API, no audio files needed) give task
 * completion and mistakes an actual sound, gated on
 * settings.soundEnabled by the caller.
 */
export const sound = {
  success() {
    playTone(660, 0.12, 0.08);
  },
  mistake() {
    playTone(220, 0.18, 0.08);
  },
};
