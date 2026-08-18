/**
 * audio.js — synthesised sound effects (Web Audio API).
 *
 * No audio files are shipped: every cue is generated from short oscillator
 * envelopes. That keeps the game to zero binary assets, makes the sounds
 * consistently clean/quiet rather than arcade-loud, and removes any
 * loading cost.
 *
 * Autoplay policy: the AudioContext is created lazily on the first real
 * user gesture and every call is wrapped so a failure can never break
 * gameplay — the game stays fully playable with sound off or unavailable.
 */

const MASTER_GAIN = 0.16;

let ctx = null;
let master = null;
let enabled = true;
let unlocked = false;

/* ------------------------------------------------------------------ */
/* Context management                                                  */
/* ------------------------------------------------------------------ */

function ensureContext() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from the first user gesture (pointerdown / click / keydown). */
export function unlockAudio() {
  if (unlocked) return;
  const c = ensureContext();
  if (!c) { unlocked = true; return; }
  if (c.state === 'suspended') c.resume().catch(() => {});
  unlocked = true;
}

export function setSoundEnabled(value) {
  enabled = !!value;
  if (enabled) unlockAudio();
}

export function isSoundEnabled() {
  return enabled;
}

/* ------------------------------------------------------------------ */
/* Synth primitives                                                    */
/* ------------------------------------------------------------------ */

/**
 * One shaped tone.
 * @param {object} o
 * @param {number} o.freq      start frequency (Hz)
 * @param {number} [o.to]      glide target frequency
 * @param {number} o.dur       duration in seconds
 * @param {string} [o.type]    oscillator waveform
 * @param {number} [o.gain]    peak gain
 * @param {number} [o.delay]   start offset in seconds
 */
function tone({ freq, to, dur = 0.12, type = 'sine', gain = 0.6, delay = 0 }) {
  const c = ensureContext();
  if (!c || !enabled) return;

  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);

  // fast attack, exponential decay — reads as "clean", never clicky
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Short filtered noise burst — used for shuffle. */
function noise({ dur = 0.16, gain = 0.25, delay = 0, freq = 1400 }) {
  const c = ensureContext();
  if (!c || !enabled) return;

  const t0 = c.currentTime + delay;
  const frames = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

  const src = c.createBufferSource();
  src.buffer = buffer;

  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.9;

  const env = c.createGain();
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/* ------------------------------------------------------------------ */
/* Cue library                                                         */
/* ------------------------------------------------------------------ */

const CUES = {
  /** soft click when a letter is picked up */
  'select-letter': () => tone({ freq: 520, dur: 0.07, type: 'triangle', gain: 0.5 }),

  /** subtle rising tick per additional letter — pitch climbs with chain length */
  'connect-letter': (step = 0) =>
    tone({ freq: 480 + Math.min(step, 7) * 55, dur: 0.06, type: 'triangle', gain: 0.42 }),

  /** satisfying two-note pop */
  'valid-word': () => {
    tone({ freq: 660, to: 990, dur: 0.13, type: 'sine', gain: 0.65 });
    tone({ freq: 990, to: 1320, dur: 0.16, type: 'sine', gain: 0.4, delay: 0.07 });
  },

  /** soft, low, non-punishing */
  'invalid-word': () => {
    tone({ freq: 240, to: 165, dur: 0.16, type: 'sine', gain: 0.42 });
  },

  /** small positive blip layered under a scoring word */
  score: () => tone({ freq: 1180, to: 1560, dur: 0.1, type: 'sine', gain: 0.3, delay: 0.05 }),

  /** already-found word */
  duplicate: () => tone({ freq: 400, dur: 0.09, type: 'sine', gain: 0.32 }),

  hint: () => {
    tone({ freq: 880, dur: 0.1, type: 'sine', gain: 0.45 });
    tone({ freq: 1320, dur: 0.14, type: 'sine', gain: 0.34, delay: 0.08 });
  },

  shuffle: () => {
    noise({ dur: 0.2, gain: 0.2, freq: 1200 });
    tone({ freq: 300, to: 620, dur: 0.2, type: 'triangle', gain: 0.3 });
  },

  'button-click': () => tone({ freq: 420, dur: 0.055, type: 'triangle', gain: 0.38 }),

  /** short major arpeggio — celebratory but restrained */
  'level-complete': () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ freq: f, dur: 0.3, type: 'sine', gain: 0.5, delay: i * 0.09 })
    );
  },

  /** descending, gentle */
  'game-over': () => {
    [440, 370, 294].forEach((f, i) =>
      tone({ freq: f, dur: 0.3, type: 'sine', gain: 0.42, delay: i * 0.13 })
    );
  },

  tick: () => tone({ freq: 1000, dur: 0.045, type: 'sine', gain: 0.22 }),
};

/**
 * Play a named cue. Unknown names, disabled sound, blocked autoplay and
 * unsupported browsers all fail silently by design.
 */
export function playSound(name, arg) {
  if (!enabled) return;
  const cue = CUES[name];
  if (!cue) return;
  try {
    if (!ctx) ensureContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    cue(arg);
  } catch {
    /* audio must never break the game */
  }
}

export const SOUND_NAMES = Object.keys(CUES);
