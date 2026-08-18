/**
 * storage.js — persistence layer (localStorage).
 *
 * Every read is defensive: private-mode / disabled-storage browsers must
 * degrade to an in-memory profile rather than throwing.
 */

const KEY = 'kompas.wordconnect.v1';

const DEFAULT_PROFILE = {
  soundEnabled: true,
  unlockedLevel: 1,          // highest level the player may enter
  completed: [],             // level ids finished at least once
  best: {},                  // { [levelId]: bestScore }
  totalScore: 0,
};

let memoryFallback = null;   // used when localStorage is unavailable

function available() {
  if (memoryFallback) return false;
  try {
    const probe = '__wc_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function readRaw() {
  if (!available()) return memoryFallback ?? (memoryFallback = { ...DEFAULT_PROFILE });
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function writeRaw(profile) {
  if (!available()) {
    memoryFallback = profile;
    return;
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    memoryFallback = profile;
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export const storage = {
  load() {
    const p = readRaw();
    // normalise shapes that may have been hand-edited or corrupted
    if (!Array.isArray(p.completed)) p.completed = [];
    if (typeof p.best !== 'object' || p.best === null) p.best = {};
    if (typeof p.unlockedLevel !== 'number' || p.unlockedLevel < 1) p.unlockedLevel = 1;
    if (typeof p.soundEnabled !== 'boolean') p.soundEnabled = true;
    if (typeof p.totalScore !== 'number') p.totalScore = 0;
    return p;
  },

  save(profile) {
    writeRaw(profile);
    return profile;
  },

  patch(partial) {
    const next = { ...this.load(), ...partial };
    writeRaw(next);
    return next;
  },

  /** Record a finished level; unlocks the next one. */
  completeLevel(levelId, score, totalLevels) {
    const p = this.load();
    if (!p.completed.includes(levelId)) p.completed.push(levelId);
    p.unlockedLevel = Math.max(p.unlockedLevel, Math.min(levelId + 1, totalLevels));
    writeRaw(p);
    return p;
  },

  /** Store a per-level best score. Returns true when it is a new record. */
  recordScore(levelId, score) {
    const p = this.load();
    const prev = p.best[levelId] || 0;
    const isRecord = score > prev;
    if (isRecord) {
      p.best[levelId] = score;
      p.totalScore = Object.values(p.best).reduce((a, b) => a + b, 0);
      writeRaw(p);
    }
    return isRecord;
  },

  bestFor(levelId) {
    return this.load().best[levelId] || 0;
  },

  reset() {
    memoryFallback = null;
    if (available()) {
      try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
    }
    return { ...DEFAULT_PROFILE };
  },
};
