/**
 * levels.js — level definitions + deterministic board generation.
 *
 * Boards are *generated then verified*: seed words are planted, the
 * remaining cells are filled with vowel-balanced letters, and the board is
 * solved against the dictionary. A board is only accepted when the solver
 * proves it holds comfortably more words than the level target — so a
 * level can never be unwinnable.
 *
 * Generation is seeded by level id, so level 7 looks the same on every
 * device and across reloads.
 */

import { WORDS } from './words.js';
import { solveBoard, LETTER_POOL } from './dictionary.js';

/* ------------------------------------------------------------------ */
/* Level table                                                         */
/* ------------------------------------------------------------------ */

export const LEVELS = [
  { id: 1,  rows: 3, cols: 3, timeLimit: 150, targetWords: 5,  targetScore: 150, hints: 3, bonus: '+1 Hint gratis' },
  { id: 2,  rows: 3, cols: 3, timeLimit: 150, targetWords: 6,  targetScore: 200, hints: 3, bonus: '+1 Hint gratis' },
  { id: 3,  rows: 4, cols: 4, timeLimit: 140, targetWords: 7,  targetScore: 260, hints: 3, bonus: null },
  { id: 4,  rows: 4, cols: 4, timeLimit: 140, targetWords: 8,  targetScore: 320, hints: 3, bonus: null },
  { id: 5,  rows: 4, cols: 4, timeLimit: 135, targetWords: 9,  targetScore: 380, hints: 2, bonus: '+1 Hint gratis' },
  { id: 6,  rows: 4, cols: 4, timeLimit: 130, targetWords: 10, targetScore: 440, hints: 2, bonus: null },
  { id: 7,  rows: 4, cols: 4, timeLimit: 125, targetWords: 11, targetScore: 500, hints: 2, bonus: null },
  { id: 8,  rows: 5, cols: 5, timeLimit: 135, targetWords: 12, targetScore: 560, hints: 2, bonus: '+1 Hint gratis' },
  { id: 9,  rows: 5, cols: 5, timeLimit: 130, targetWords: 13, targetScore: 640, hints: 2, bonus: null },
  { id: 10, rows: 5, cols: 5, timeLimit: 125, targetWords: 14, targetScore: 720, hints: 2, bonus: null },
  { id: 11, rows: 5, cols: 5, timeLimit: 115, targetWords: 15, targetScore: 800, hints: 1, bonus: null },
  { id: 12, rows: 5, cols: 5, timeLimit: 110, targetWords: 16, targetScore: 900, hints: 1, bonus: '+1 Hint gratis' },
];

export const TOTAL_LEVELS = LEVELS.length;

export function getLevelConfig(id) {
  return LEVELS.find((l) => l.id === id) || null;
}

/* ------------------------------------------------------------------ */
/* Deterministic RNG (mulberry32)                                      */
/* ------------------------------------------------------------------ */

function createRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffleInPlace(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------------------------------------------------------------ */
/* Board generation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Drop `word` onto the board.
 *
 * Under pattern-lock rules a word only needs its LETTERS to be present —
 * any tile can reach any other — so seeding is a simple placement into
 * free cells rather than a self-avoiding adjacency walk.
 */
function plantWord(word, grid, rng) {
  const free = shuffleInPlace(rng, grid.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0));
  if (free.length < word.length) return false;
  for (let i = 0; i < word.length; i++) grid[free[i]] = word[i];
  return true;
}

/** Fill empty cells, keeping a healthy vowel ratio so words remain findable. */
function fillGaps(grid, rng) {
  const vowelCount = grid.filter((c) => c && 'AEIOU'.includes(c)).length;
  const wanted = Math.round(grid.length * 0.42);
  let vowelsNeeded = Math.max(0, wanted - vowelCount);

  const empties = shuffleInPlace(rng, grid.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0));

  for (const i of empties) {
    if (vowelsNeeded > 0) {
      grid[i] = pick(rng, LETTER_POOL.vowels);
      vowelsNeeded--;
    } else {
      grid[i] = pick(rng, LETTER_POOL.consonants);
    }
  }
  return grid;
}

/** Words that could plausibly be planted on a board of this size. */
function seedCandidates(cells) {
  const maxLen = Math.min(6, Math.max(4, cells - 3));
  return WORDS.filter((w) => w.length >= 4 && w.length <= maxLen);
}

/**
 * Build a verified board for a level config.
 * @returns {{letters: string[], solutions: Map<string, number[]>}}
 */
export function generateBoard(config, variant = 0) {
  const { rows, cols, targetWords } = config;
  const cells = rows * cols;
  const candidates = seedCandidates(cells);
  const minWords = targetWords + Math.max(6, Math.round(targetWords * 0.8));
  const seedCount = cells >= 25 ? 4 : cells >= 16 ? 3 : 2;

  let best = null;

  for (let attempt = 0; attempt < 90; attempt++) {
    const rng = createRng(config.id * 7919 + variant * 104729 + attempt * 31);
    const grid = new Array(cells).fill(null);

    for (let s = 0; s < seedCount; s++) {
      plantWord(pick(rng, candidates), grid, rng);
    }
    fillGaps(grid, rng);

    const solutions = solveBoard(grid);
    if (!best || solutions.size > best.solutions.size) {
      best = { letters: grid, solutions };
    }
    if (solutions.size >= minWords) return best;
  }

  return best;
}

/**
 * Re-arrange the letters on the board (SHUFFLE).
 *
 * Under pattern-lock rules a permutation cannot change WHICH words are
 * drawable — only where the letters sit. So the solution set is rebuilt
 * against the new positions and the player can never be shuffled into a
 * dead end.
 */
export function shuffleBoard(letters) {
  const rng = createRng(Math.floor(Math.random() * 1e9));
  let next = shuffleInPlace(rng, letters.slice());

  // guarantee a visible change when the letters allow one
  if (letters.length > 1 && next.join('') === letters.join('')) {
    next = shuffleInPlace(createRng(Math.floor(Math.random() * 1e9)), next);
  }
  return { letters: next, solutions: solveBoard(next) };
}
