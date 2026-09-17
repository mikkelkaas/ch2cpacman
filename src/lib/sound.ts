import { storage } from './storage';

/**
 * Small chiptune cues generated with the Web Audio API, so nothing is
 * downloaded and the page works offline. Every cue is a no-op when muted or
 * when AudioContext is missing (tests, old browsers).
 */
let ctx: AudioContext | null = null;
let muted = storage.isMuted();

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, freq: number, startS: number, durS: number, type: OscillatorType = 'square', gain = 0.08) {
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.setValueAtTime(gain, ac.currentTime + startS);
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + startS + durS);
  osc.connect(amp).connect(ac.destination);
  osc.start(ac.currentTime + startS);
  osc.stop(ac.currentTime + startS + durS + 0.02);
}

function play(notes: Array<[freq: number, at: number, dur: number]>, type: OscillatorType = 'square') {
  if (muted) return;
  const ac = context();
  if (!ac) return;
  for (const [f, at, dur] of notes) tone(ac, f, at, dur, type);
}

export const sound = {
  isMuted: () => muted,
  setMuted(value: boolean) {
    muted = value;
    storage.setMuted(value);
  },
  /** Call from a user gesture so the context is allowed to start on iOS. */
  unlock() {
    context();
  },
  chomp: () => play([[659, 0, 0.06], [523, 0.07, 0.06]]),
  startJingle: () => play([[392, 0, 0.12], [494, 0.13, 0.12], [587, 0.26, 0.12], [784, 0.39, 0.25]]),
  gameOver: () => play([[784, 0, 0.15], [659, 0.16, 0.15], [523, 0.32, 0.15], [392, 0.48, 0.15], [262, 0.64, 0.4]], 'triangle'),
  blip: () => play([[1046, 0, 0.03]]),
};
