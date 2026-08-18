/**
 * api.js — the single boundary between the game and its data source.
 *
 * Everything here is async and returns plain, JSON-serialisable DTOs, so
 * swapping the mock implementation for a real backend is a change *inside
 * this file only*:
 *
 *   export async function fetchLevelData(id) {
 *     const res = await fetch(`/api/levels/${id}`);
 *     return res.json();
 *   }
 *
 * No other module imports `levels.js` / `dictionary.js` directly for data.
 */

import { LEVELS, TOTAL_LEVELS, getLevelConfig, generateBoard, shuffleBoard } from './levels.js';

/**
 * Yields to the event loop so callers are genuinely async (as a real
 * fetch would be). Deliberately a timer rather than rAF: rAF is frozen in
 * background/hidden tabs, which would leave boot hanging forever.
 */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Level catalogue — everything the level-select screen needs. */
export async function fetchLevelList() {
  await tick();
  return {
    total: TOTAL_LEVELS,
    levels: LEVELS.map(({ id, rows, cols, timeLimit, targetWords, targetScore, hints, bonus }) => ({
      id, rows, cols, timeLimit, targetWords, targetScore, hints, bonus,
    })),
  };
}

/** Metadata for the "level info" screen (no board yet — cheap). */
export async function fetchLevelInfo(id) {
  await tick();
  const config = getLevelConfig(id);
  if (!config) throw new Error(`Level ${id} tidak ditemukan`);
  return { ...config };
}

/**
 * Full playable payload: config + verified board + solution set.
 * `variant` lets a retry produce a fresh board for the same level.
 *
 * @returns {Promise<{
 *   id:number, rows:number, cols:number, timeLimit:number,
 *   targetWords:number, targetScore:number, hints:number, bonus:string|null,
 *   letters:string[], solutions:Array<{word:string, path:number[]}>
 * }>}
 */
export async function fetchLevelData(id, variant = 0) {
  await tick();
  const config = getLevelConfig(id);
  if (!config) throw new Error(`Level ${id} tidak ditemukan`);

  const board = generateBoard(config, variant);
  const solutions = [...board.solutions.entries()]
    .map(([word, path]) => ({ word, path }))
    .sort((a, b) => a.word.length - b.word.length || a.word.localeCompare(b.word));

  return { ...config, letters: board.letters, solutions };
}

/**
 * Re-arrange an in-play board. Kept behind the same boundary so a server
 * could own shuffling (and its anti-cheat solution set) later.
 *
 * @returns {Promise<{letters:string[], solutions:Array<{word:string,path:number[]}>}>}
 */
export async function requestShuffle(letters) {
  await tick();
  const result = shuffleBoard(letters);
  return {
    letters: result.letters,
    solutions: [...result.solutions.entries()].map(([word, path]) => ({ word, path })),
  };
}
