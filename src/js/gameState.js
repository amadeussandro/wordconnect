/**
 * gameState.js — the single source of truth.
 *
 * Pure data + a tiny subscribe/notify bus. It never touches the DOM; the
 * UI layer reads from here and re-renders. That separation is what keeps
 * the engine testable and the renderer replaceable.
 */

import { storage } from './storage.js';

export const SCREENS = Object.freeze({
  MENU: 'menu',
  LEVELS: 'levels',
  INFO: 'info',
  GAME: 'game',
});

function blankLevelState() {
  return {
    levelId: null,
    rows: 0,
    cols: 0,
    letters: [],
    solutions: new Map(),   // word → canonical path
    targetWords: 0,
    targetScore: 0,
    timeLimit: 0,
    bonus: null,
    variant: 0,
  };
}

function blankRuntime() {
  return {
    score: 0,
    timeRemaining: 0,
    selection: [],          // cell indices, in order
    foundWords: new Map(),  // word → points earned
    hintsRemaining: 0,
    isRunning: false,
    isPaused: false,
    isGameOver: false,
    isLevelComplete: false,
  };
}

class GameState {
  constructor() {
    const profile = storage.load();

    this.screen = SCREENS.MENU;
    this.soundEnabled = profile.soundEnabled;
    this.unlockedLevel = profile.unlockedLevel;
    this.completed = new Set(profile.completed);
    this.best = { ...profile.best };
    this.pendingLevelId = 1;

    this.level = blankLevelState();
    Object.assign(this, blankRuntime());

    this._listeners = new Set();
  }

  /* ---------------- pub/sub ---------------- */

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  emit(event = 'change', detail = null) {
    for (const fn of this._listeners) fn(event, detail, this);
  }

  /* ---------------- navigation ---------------- */

  setScreen(screen) {
    this.screen = screen;
    this.emit('screen', screen);
  }

  /* ---------------- level lifecycle ---------------- */

  /** Load a fetched level payload into state and arm the runtime. */
  loadLevel(payload, variant = 0) {
    this.level = {
      levelId: payload.id,
      rows: payload.rows,
      cols: payload.cols,
      letters: payload.letters.slice(),
      solutions: new Map(payload.solutions.map((s) => [s.word, s.path])),
      targetWords: Math.min(payload.targetWords, payload.solutions.length),
      targetScore: payload.targetScore,
      timeLimit: payload.timeLimit,
      bonus: payload.bonus,
      variant,
    };

    Object.assign(this, blankRuntime());
    this.timeRemaining = payload.timeLimit;
    this.hintsRemaining = payload.hints + (payload.bonus ? 1 : 0);
    this.emit('level-loaded');
  }

  get bestForCurrentLevel() {
    return this.best[this.level.levelId] || 0;
  }

  get totalBest() {
    return Object.values(this.best).reduce((a, b) => a + b, 0);
  }

  get remainingSolutions() {
    return [...this.level.solutions.keys()].filter((w) => !this.foundWords.has(w));
  }

  get progressRatio() {
    if (!this.level.targetWords) return 0;
    return Math.min(1, this.foundWords.size / this.level.targetWords);
  }

  /* ---------------- selection ---------------- */

  get selectedWord() {
    return this.selection.map((i) => this.level.letters[i]).join('');
  }

  clearSelection() {
    this.selection = [];
  }

  /* ---------------- scoring ---------------- */

  addScore(points) {
    this.score += points;
    this.emit('score', points);
  }

  recordWord(word, points) {
    this.foundWords.set(word, points);
    this.addScore(points);
    this.emit('word-found', { word, points });
  }

  /* ---------------- persistence-backed mutations ---------------- */

  setSound(enabled) {
    this.soundEnabled = enabled;
    storage.patch({ soundEnabled: enabled });
    this.emit('sound', enabled);
  }

  /** Commit a finished level. Returns { isRecord, previousBest }. */
  commitLevelResult(totalLevels) {
    const levelId = this.level.levelId;
    const previousBest = this.best[levelId] || 0;
    const isRecord = storage.recordScore(levelId, this.score);

    if (this.isLevelComplete) {
      const profile = storage.completeLevel(levelId, this.score, totalLevels);
      this.unlockedLevel = profile.unlockedLevel;
      this.completed = new Set(profile.completed);
    }

    if (isRecord) this.best[levelId] = this.score;
    return { isRecord, previousBest };
  }

  isLevelUnlocked(id) {
    return id <= this.unlockedLevel;
  }

  statusOf(id) {
    if (this.completed.has(id)) return 'done';
    if (id > this.unlockedLevel) return 'locked';
    if (id === this.unlockedLevel) return 'current';
    return 'new';
  }
}

export const state = new GameState();
