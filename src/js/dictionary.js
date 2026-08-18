/**
 * dictionary.js — word index + board solver.
 *
 * GESTURE MODEL: the board is a pattern-lock, not a Boggle grid. A gesture
 * may travel any distance in any direction, so a word is playable whenever
 * its letters can be drawn from the tiles on the board (each tile once) —
 * adjacency is NOT a constraint.
 *
 * The solver therefore matches on letter multisets rather than walking an
 * adjacency graph. This is what keeps the "is this a word?" answer in sync
 * with what the player is physically able to draw.
 */

import { WORDS, MIN_WORD_LENGTH } from './words.js';

const A_CODE = 65;
const ALPHABET = 26;

/** Letter histogram for a string, as a 26-slot vector. */
function histogram(letters) {
  const counts = new Uint8Array(ALPHABET);
  for (let i = 0; i < letters.length; i++) {
    const code = letters.charCodeAt ? letters.charCodeAt(i) : letters[i].charCodeAt(0);
    const slot = code - A_CODE;
    if (slot >= 0 && slot < ALPHABET) counts[slot]++;
  }
  return counts;
}

/** Precomputed histogram per dictionary word — built once, reused per level. */
const WORD_INDEX = WORDS.map((word) => ({
  word,
  len: word.length,
  counts: histogram(word),
}));

const WORD_SET = new Set(WORDS);

/** Is this an exact dictionary entry? */
export function isWord(word) {
  return WORD_SET.has(String(word).toUpperCase());
}

/** Letters available for random fill, weighted toward Indonesian frequency. */
export const LETTER_POOL = {
  vowels: 'AAAAAEEEIIIOOUU'.split(''),
  consonants: 'NNNRRTTSSKKMMDDGGPPBBLLHJCWY'.split(''),
};

/* ------------------------------------------------------------------ */
/* Tile assignment                                                     */
/* ------------------------------------------------------------------ */

/**
 * Map each letter of `word` onto a distinct tile index.
 * Used for hints (which tiles to light up) and for validating that a word
 * is physically drawable on this board.
 *
 * @returns {number[]|null} tile indices in word order, or null if impossible
 */
export function assignTiles(word, letters) {
  const used = new Uint8Array(letters.length);
  const path = [];

  for (const ch of word) {
    let found = -1;
    for (let i = 0; i < letters.length; i++) {
      if (!used[i] && letters[i] === ch) { found = i; break; }
    }
    if (found === -1) return null;
    used[found] = 1;
    path.push(found);
  }
  return path;
}

/* ------------------------------------------------------------------ */
/* Board solver                                                        */
/* ------------------------------------------------------------------ */

/**
 * Every dictionary word this board can produce.
 *
 * @param {string[]} letters flat grid, row-major
 * @returns {Map<string, number[]>} word → tile indices that spell it
 */
export function solveBoard(letters) {
  const board = histogram(letters.join(''));
  const size = letters.length;
  const found = new Map();

  outer:
  for (const entry of WORD_INDEX) {
    if (entry.len < MIN_WORD_LENGTH || entry.len > size) continue;
    for (let s = 0; s < ALPHABET; s++) {
      if (entry.counts[s] > board[s]) continue outer;
    }
    const path = assignTiles(entry.word, letters);
    if (path) found.set(entry.word, path);
  }
  return found;
}

/** Locate the tiles that spell `word` on this board, or null. */
export function findPath(word, letters) {
  return assignTiles(String(word).toUpperCase(), letters);
}
