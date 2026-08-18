/**
 * wordValidator.js — the rules of the game, expressed as pure functions.
 *
 * Nothing here knows about the DOM, sound or animation; it answers two
 * questions only: "may I extend this chain?" and "is this chain a word?".
 */

import { MIN_WORD_LENGTH } from './words.js';

export { MIN_WORD_LENGTH };

export const RESULT = Object.freeze({
  VALID: 'valid',
  TOO_SHORT: 'too-short',
  DUPLICATE: 'duplicate',
  NOT_A_WORD: 'not-a-word',
});

/** Points per word length — longer chains are worth disproportionately more. */
export function scoreFor(word) {
  const n = word.length;
  if (n <= 3) return 20;
  if (n === 4) return 30;
  if (n === 5) return 40;
  if (n === 6) return 60;
  return 60 + (n - 6) * 25;
}

/**
 * May `next` be appended to the current chain?
 *
 * Pattern-lock rules: the only constraint is that a tile cannot be used
 * twice. Distance and direction are irrelevant — reachability is decided
 * by the gesture itself (see the segment-intersection engine in game.js),
 * not by grid adjacency.
 */
export function canExtend(selection, next) {
  return !selection.includes(next);
}

/** True when the pointer moved back onto the previous tile (undo one step). */
export function isBacktrack(selection, next) {
  return selection.length >= 2 && selection[selection.length - 2] === next;
}

/**
 * Judge a completed chain.
 *
 * @param {string} word
 * @param {Map<string, number[]>} solutions words the board actually contains
 * @param {Map<string, number>} foundWords already-scored words
 */
export function validateWord(word, solutions, foundWords) {
  if (word.length < MIN_WORD_LENGTH) {
    return { result: RESULT.TOO_SHORT, points: 0, message: `Minimal ${MIN_WORD_LENGTH} huruf` };
  }
  if (foundWords.has(word)) {
    return { result: RESULT.DUPLICATE, points: 0, message: 'Sudah ditemukan' };
  }
  if (!solutions.has(word)) {
    return { result: RESULT.NOT_A_WORD, points: 0, message: 'Bukan kata' };
  }
  return { result: RESULT.VALID, points: scoreFor(word), message: praiseFor(word) };
}

/** A short, non-repetitive bit of encouragement. */
function praiseFor(word) {
  if (word.length >= 6) return 'Luar biasa!';
  if (word.length === 5) return 'Keren!';
  if (word.length === 4) return 'Bagus!';
  return 'Tepat!';
}

/** Pick the hint that helps most: the shortest word still unfound. */
export function chooseHint(solutions, foundWords) {
  const remaining = [...solutions.entries()].filter(([word]) => !foundWords.has(word));
  if (remaining.length === 0) return null;
  remaining.sort((a, b) => a[0].length - b[0].length);
  const pool = remaining.slice(0, Math.max(1, Math.ceil(remaining.length * 0.35)));
  const [word, path] = pool[Math.floor(Math.random() * pool.length)];
  return { word, path };
}
