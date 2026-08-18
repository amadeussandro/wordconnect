/**
 * game.js — the engine.
 *
 * Owns: board rendering, the pointer/keyboard letter-connect mechanic,
 * the countdown, word submission, hint, shuffle and level lifecycle.
 * Reads/writes `gameState`, delegates all chrome rendering to `ui.js`.
 */

import { state, SCREENS } from './gameState.js';
import * as api from './api.js';
import { TOTAL_LEVELS } from './levels.js';
import { playSound } from './audio.js';
import { canExtend, isBacktrack, validateWord, chooseHint, RESULT } from './wordValidator.js';
import { floatScore, sparkBurst } from './animation.js';
import * as ui from './ui.js';

const el = ui.el;

/* ------------------------------------------------------------------ */
/* Board geometry                                                      */
/* ------------------------------------------------------------------ */

let tileNodes = [];
let centers = [];        // { x, y } node centres, relative to the board box
let hitRadius = 0;       // gesture catch radius per node
let tileSize = 0;
let boardBox = null;     // cached bounding rect, refreshed on drag start / resize

function measureBoard() {
  if (!tileNodes.length) return;
  boardBox = el.board.getBoundingClientRect();

  centers = tileNodes.map((node) => {
    const r = node.getBoundingClientRect();
    return {
      x: r.left - boardBox.left + r.width / 2,
      y: r.top - boardBox.top + r.height / 2,
    };
  });

  tileSize = tileNodes[0].getBoundingClientRect().width || 1;

  /*
   * Catch radius is derived from the SPACING between nodes, not the tile
   * size, so the free corridor between two nodes stays proportionally the
   * same on a 3x3 and a 5x5. That corridor is what makes this a pattern
   * lock rather than a grid: a gesture can steer between two letters
   * without grabbing either, so long diagonals and crossing paths are
   * genuinely drawable at any density.
   *
   * The floor keeps the visible tile fully catchable when aiming directly.
   */
  const spacing = centers.length > 1
    ? Math.hypot(centers[1].x - centers[0].x, centers[1].y - centers[0].y)
    : tileSize * 1.45;
  hitRadius = Math.max(tileSize * 0.46, spacing * 0.33);

  el.boardLines.setAttribute('viewBox', `0 0 ${boardBox.width} ${boardBox.height}`);
  el.boardLines.style.setProperty('--line-w', `${Math.max(6, tileSize * 0.17)}`);
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

export function renderBoard() {
  const { letters, rows, cols } = state.level;

  el.board.style.setProperty('--rows', rows);
  el.board.style.setProperty('--cols', cols);
  /*
   * Gap is a PERCENTAGE of the board, so spacing scales with the puzzle and
   * stays proportionally airy at every size. Roughly 45% of a tile's width —
   * the whitespace the gesture needs in order to travel between nodes
   * without grabbing them.
   */
  el.board.style.setProperty('--tile-gap', cols >= 5 ? '6.5%' : cols >= 4 ? '8.5%' : '12%');

  el.boardTiles.innerHTML = letters
    .map((ch, i) => `
      <button class="tile" type="button" data-index="${i}" tabindex="-1"
              aria-label="Huruf ${ch}"><span class="tile__char">${ch}</span></button>`)
    .join('');

  tileNodes = [...el.boardTiles.children];
  measureBoard();                       // synchronous first pass
  requestAnimationFrame(measureBoard);  // again once fonts/layout settle
}

function updateTileLetters() {
  state.level.letters.forEach((ch, i) => {
    const node = tileNodes[i];
    if (!node) return;
    node.querySelector('.tile__char').textContent = ch;
    node.setAttribute('aria-label', `Huruf ${ch}`);
  });
}

function clearTileStates(...classes) {
  const list = classes.length ? classes : ['is-selected', 'is-head', 'is-valid', 'is-invalid', 'is-dupe', 'is-hinted'];
  tileNodes.forEach((n) => n.classList.remove(...list));
}

function paintSelection() {
  tileNodes.forEach((n) => n.classList.remove('is-selected', 'is-head'));
  state.selection.forEach((index, i) => {
    tileNodes[index]?.classList.add('is-selected');
    if (i === state.selection.length - 1) tileNodes[index]?.classList.add('is-head');
  });
}

/* ---------------- connection path ---------------- */

let livePoint = null;    // current pointer position while dragging

/**
 * Draw the gesture trail: a soft glow underneath, the solid path on top,
 * and a lighter "reaching" segment from the last node to the finger.
 * Rendered behind the tiles, so it never covers a letter.
 */
function drawLines(variant = '') {
  if (!centers.length) { el.boardLines.innerHTML = ''; return; }

  const pts = state.selection.map((i) => centers[i]).filter(Boolean);
  if (pts.length === 0) { el.boardLines.innerHTML = ''; return; }

  const fmt = (p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  const solid = pts.map(fmt).join(' ');
  const cls = variant ? ` board__line--${variant}` : '';

  let markup = '';

  // glow underlay (skipped once the word resolves, to keep feedback crisp)
  if (!variant && pts.length > 1) {
    markup += `<polyline class="board__glow" points="${solid}"/>`;
  }
  if (pts.length > 1) {
    markup += `<polyline class="board__line${cls}" points="${solid}"/>`;
  }

  // live trail toward the finger
  if (livePoint && !variant) {
    const last = pts[pts.length - 1];
    markup += `<line class="board__trail" x1="${last.x.toFixed(1)}" y1="${last.y.toFixed(1)}" ` +
              `x2="${livePoint.x.toFixed(1)}" y2="${livePoint.y.toFixed(1)}"/>`;
  }

  // a lone node still deserves a visible anchor dot
  if (pts.length === 1 && !variant) {
    markup += `<circle class="board__anchor" cx="${pts[0].x.toFixed(1)}" cy="${pts[0].y.toFixed(1)}" r="5"/>`;
  }

  el.boardLines.innerHTML = markup;
}

/* ------------------------------------------------------------------ */
/* Pointer interaction (Pointer Events — one path for mouse + touch)   */
/* ------------------------------------------------------------------ */

let dragging = false;
let activePointerId = null;
let lastSample = null;   // last sampled board-space point, for segment interpolation
let locked = false;      // true during submit animations / modals

function pointToBoard(event) {
  if (!boardBox) measureBoard();
  return { x: event.clientX - boardBox.left, y: event.clientY - boardBox.top };
}

/**
 * Node whose catch circle contains this point (nearest wins), or -1.
 * Used only to START a gesture — mid-gesture selection is decided by
 * segment intersection below, not by proximity.
 */
function nodeAt(point) {
  let best = -1;
  let bestDist = hitRadius * hitRadius;

  for (let i = 0; i < centers.length; i++) {
    const dx = point.x - centers[i].x;
    const dy = point.y - centers[i].y;
    const d = dx * dx + dy * dy;
    if (d <= bestDist) { bestDist = d; best = i; }
  }
  return best;
}

/**
 * Which nodes does the segment A→B pass through, and in what order?
 *
 * Solves the segment/circle intersection analytically for every node and
 * returns them sorted by ENTRY parameter, so a single fast flick that
 * crosses three letters selects them in the order the finger actually met
 * them — not by distance from the pointer, and not by grid adjacency.
 *
 *   A ●─────────────────● B
 *          ╲
 *           (K)   ← intersected → selected
 *
 * @returns {Array<{index:number, t:number}>} ordered hits along the segment
 */
function segmentHits(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const aa = dx * dx + dy * dy;
  const hits = [];

  // A stationary pointer still needs to register the node it rests on.
  if (aa < 1e-6) {
    const index = nodeAt(to);
    return index >= 0 ? [{ index, t: 0 }] : [];
  }

  for (let i = 0; i < centers.length; i++) {
    const fx = from.x - centers[i].x;
    const fy = from.y - centers[i].y;

    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - hitRadius * hitRadius;
    const disc = b * b - 4 * aa * c;
    if (disc < 0) continue;                 // the line misses this circle

    const root = Math.sqrt(disc);
    const t1 = (-b - root) / (2 * aa);
    const t2 = (-b + root) / (2 * aa);
    if (t2 < 0 || t1 > 1) continue;         // intersection lies off the segment

    hits.push({ index: i, t: Math.max(0, t1) });
  }

  hits.sort((a, b2) => a.t - b2.t);
  return hits;
}

function beginDrag(event) {
  if (locked || !state.isRunning || state.isPaused) return;
  // a second finger landing mid-drag must not hijack the chain
  if (dragging) return;

  const point = pointToBoard(event);
  const index = nodeAt(point);
  if (index < 0) return;                    // pressing empty space starts nothing

  dragging = true;
  activePointerId = event.pointerId;
  el.board.classList.add('is-dragging');
  try { el.board.setPointerCapture(event.pointerId); } catch { /* older engines */ }

  state.selection = [index];
  livePoint = point;
  lastSample = point;

  paintSelection();
  drawLines();
  ui.renderCurrentWord(state.selectedWord);
  playSound('select-letter');
}

/**
 * Fold one intersected node into the chain.
 * Backtracking onto the previous node undoes a step, exactly like
 * correcting a phone pattern; re-touching any other selected node is
 * ignored so a gesture can sweep back over itself without duplicating.
 */
function takeNode(index) {
  if (isBacktrack(state.selection, index)) {
    state.selection.pop();
    return true;
  }
  if (canExtend(state.selection, index)) {
    state.selection.push(index);
    playSound('connect-letter', state.selection.length);
    return true;
  }
  return false;                             // already in the chain — no duplicate
}

/** Advance the gesture along the segment from the last sample to `to`. */
function traceTo(to) {
  const from = lastSample || to;
  let changed = false;

  for (const hit of segmentHits(from, to)) {
    if (takeNode(hit.index)) changed = true;
  }

  lastSample = to;
  return changed;
}

function moveDrag(event) {
  if (!dragging || event.pointerId !== activePointerId) return;

  // Coalesced events expose every position the browser captured between
  // frames, so the traced polyline matches the real finger path.
  let samples;
  if (typeof event.getCoalescedEvents === 'function') {
    const coalesced = event.getCoalescedEvents();
    samples = coalesced.length ? coalesced : [event];
  } else {
    samples = [event];
  }

  let changed = false;
  for (const sample of samples) {
    if (traceTo(pointToBoard(sample))) changed = true;
  }

  livePoint = lastSample;
  if (changed) {
    paintSelection();
    ui.renderCurrentWord(state.selectedWord);
  }
  drawLines();
}

function endDrag(event) {
  if (!dragging) return;
  if (event && event.pointerId !== activePointerId) return;

  dragging = false;
  activePointerId = null;
  livePoint = null;
  lastSample = null;
  el.board.classList.remove('is-dragging');

  submitSelection();
}

/* ------------------------------------------------------------------ */
/* Word submission                                                     */
/* ------------------------------------------------------------------ */

function centroidOf(indices) {
  const pts = indices.map((i) => centers[i]).filter(Boolean);
  if (!pts.length) return { x: boardBox?.width / 2 || 0, y: boardBox?.height / 2 || 0 };
  return {
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
  };
}

function submitSelection() {
  const word = state.selectedWord;
  const indices = state.selection.slice();

  if (indices.length === 0) { resetSelection(); return; }

  const verdict = validateWord(word, state.level.solutions, state.foundWords);

  if (verdict.result === RESULT.VALID) {
    onValidWord(word, verdict, indices);
  } else if (verdict.result === RESULT.DUPLICATE) {
    onSoftReject(word, indices, 'is-dupe', 'dupe', verdict.message, 'duplicate');
  } else if (verdict.result === RESULT.TOO_SHORT && indices.length === 1) {
    resetSelection();   // a single tap is a cancel, not a mistake
  } else {
    onSoftReject(word, indices, 'is-invalid', 'invalid', verdict.message, 'invalid-word');
  }
}

function onValidWord(word, verdict, indices) {
  locked = true;

  indices.forEach((i) => {
    tileNodes[i]?.classList.remove('is-selected', 'is-head');
    tileNodes[i]?.classList.add('is-valid');
  });
  drawLines('valid');
  ui.renderCurrentWord(word, 'valid', verdict.message);

  playSound('valid-word');
  playSound('score');

  const at = centroidOf(indices);
  floatScore(el.fxLayer, at, verdict.points, verdict.message);
  sparkBurst(el.fxLayer, at, 9);

  state.recordWord(word, verdict.points);
  ui.bumpScore();
  ui.renderHud();
  ui.renderFoundWords();

  setTimeout(() => {
    clearTileStates('is-valid');
    resetSelection();
    locked = false;
    if (state.foundWords.size >= state.level.targetWords) completeLevel();
  }, 420);
}

function onSoftReject(word, indices, tileClass, chipVariant, message, sound) {
  locked = true;

  indices.forEach((i) => {
    tileNodes[i]?.classList.remove('is-selected', 'is-head');
    tileNodes[i]?.classList.add(tileClass);
  });
  drawLines(chipVariant === 'dupe' ? '' : 'invalid');
  ui.renderCurrentWord(word, chipVariant, message);
  playSound(sound);

  setTimeout(() => {
    clearTileStates(tileClass);
    resetSelection();
    locked = false;
  }, 380);
}

function resetSelection() {
  state.clearSelection();
  livePoint = null;
  paintSelection();
  drawLines();
  ui.renderCurrentWord('');
}

/* ------------------------------------------------------------------ */
/* Keyboard play                                                       */
/* ------------------------------------------------------------------ */

let cursor = 0;

function paintCursor() {
  tileNodes.forEach((n, i) => n.classList.toggle('is-cursor', i === cursor));
}

function moveCursor(dr, dc) {
  const { rows, cols } = state.level;
  const r = Math.min(rows - 1, Math.max(0, Math.floor(cursor / cols) + dr));
  const c = Math.min(cols - 1, Math.max(0, (cursor % cols) + dc));
  cursor = r * cols + c;
  paintCursor();
}

function handleBoardKey(event) {
  if (!state.isRunning || state.isPaused || locked || ui.isModalOpen()) return;

  const keys = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
  };

  if (keys[event.key]) {
    event.preventDefault();
    moveCursor(...keys[event.key]);
    return;
  }

  if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    if (isBacktrack(state.selection, cursor)) {
      state.selection.pop();
    } else if (canExtend(state.selection, cursor)) {
      state.selection.push(cursor);
      playSound(state.selection.length === 1 ? 'select-letter' : 'connect-letter', state.selection.length);
    }
    paintSelection();
    drawLines();
    ui.renderCurrentWord(state.selectedWord);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    submitSelection();
    return;
  }

  if (event.key === 'Escape' || event.key === 'Backspace') {
    event.preventDefault();
    resetSelection();
  }
}

/* ------------------------------------------------------------------ */
/* Timer                                                               */
/* ------------------------------------------------------------------ */

let timerId = null;
let lastTick = 0;
let lastWholeSecond = -1;

function startTimer() {
  stopTimer();
  lastTick = performance.now();
  timerId = setInterval(onTick, 200);
}

function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

function onTick() {
  const now = performance.now();
  const delta = (now - lastTick) / 1000;
  lastTick = now;

  if (!state.isRunning || state.isPaused) return;

  state.timeRemaining = Math.max(0, state.timeRemaining - delta);
  const whole = Math.ceil(state.timeRemaining);

  if (whole !== lastWholeSecond) {
    lastWholeSecond = whole;
    ui.renderTimer();
    if (whole <= 10 && whole > 0) playSound('tick');
  }

  if (state.timeRemaining <= 0) endGame();
}

/* ------------------------------------------------------------------ */
/* Level lifecycle                                                     */
/* ------------------------------------------------------------------ */

export async function startLevel(levelId, variant = 0) {
  const payload = await api.fetchLevelData(levelId, variant);
  state.loadLevel(payload, variant);

  cursor = 0;
  locked = false;
  dragging = false;

  ui.showScreen(SCREENS.GAME);
  state.setScreen(SCREENS.GAME);

  renderBoard();
  resetSelection();
  ui.renderHud();
  ui.renderTimer();
  ui.renderFoundWords();
  paintCursor();

  state.isRunning = true;
  state.isPaused = false;
  lastWholeSecond = -1;
  startTimer();
}

/**
 * Show the pause modal, whatever the current paused flag says.
 * Used both to pause fresh and to come *back* from the exit confirmation —
 * the latter is already paused, so it must not be guarded.
 */
export function showPauseModal() {
  state.isPaused = true;
  resetSelection();
  ui.open({ ...ui.modals.pause(), onDismiss: unpause });
}

export function pauseGame() {
  if (!state.isRunning || state.isPaused || ui.isModalOpen()) return;
  playSound('button-click');
  showPauseModal();
}

/** Restore the clock after a modal that only *suspended* play (pause/hint/shuffle). */
export function unpause() {
  state.isPaused = false;
  lastTick = performance.now();
}

export function resumeGame() {
  unpause();
  ui.closeModal();
}

export function restartLevel() {
  ui.closeModal();
  stopTimer();
  state.isRunning = false;
  setTimeout(() => startLevel(state.level.levelId, state.level.variant + 1), 200);
}

export function retryLevel() {
  ui.closeModal();
  stopTimer();
  state.isRunning = false;
  setTimeout(() => startLevel(state.level.levelId, state.level.variant + 1), 200);
}

export function abandonLevel() {
  stopTimer();
  state.isRunning = false;
  state.isPaused = false;
  resetSelection();
}

/* ---------------- endings ---------------- */

let pendingRecord = false;

function completeLevel() {
  stopTimer();
  state.isRunning = false;
  state.isLevelComplete = true;

  const { isRecord } = state.commitLevelResult(TOTAL_LEVELS);
  pendingRecord = isRecord;

  playSound('level-complete');

  ui.open(ui.modals.win({
    levelId: state.level.levelId,
    score: state.score,
    words: state.foundWords.size,
    timeLeft: Math.max(0, Math.ceil(state.timeRemaining)),
    isRecord,
    isLast: state.level.levelId >= TOTAL_LEVELS,
  }));
}

function endGame() {
  stopTimer();
  state.isRunning = false;
  state.isGameOver = true;
  resetSelection();
  ui.renderTimer();

  const { isRecord } = state.commitLevelResult(TOTAL_LEVELS);
  playSound('game-over');

  ui.open(ui.modals.gameover({
    score: state.score,
    words: state.foundWords.size,
    target: state.level.targetWords,
    isRecord,
  }));
}

/** Called from the win modal's "Lanjut". Returns the next level id, or null. */
export function consumeWin() {
  if (pendingRecord) {
    pendingRecord = false;
    ui.closeModal();
    setTimeout(() => ui.open(ui.modals.newbest({ score: state.score })), 200);
    return 'newbest';
  }
  return nextLevelId();
}

export function nextLevelId() {
  const next = state.level.levelId + 1;
  return next <= TOTAL_LEVELS ? next : null;
}

/* ------------------------------------------------------------------ */
/* Hint                                                                */
/* ------------------------------------------------------------------ */

export function requestHint() {
  if (!state.isRunning || state.hintsRemaining <= 0) return;
  state.isPaused = true;
  ui.open({ ...ui.modals.hint(state.hintsRemaining), onDismiss: unpause });
}

export function applyHint() {
  ui.closeModal();
  unpause();

  const hint = chooseHint(state.level.solutions, state.foundWords);
  if (!hint) {
    ui.showToast('Semua kata sudah ditemukan!', 'success', 'check-circle');
    return;
  }

  state.hintsRemaining -= 1;
  ui.renderHud();
  playSound('hint');

  resetSelection();
  clearTileStates('is-hinted');

  // walk the path so the player can trace it themselves
  hint.path.forEach((index, i) => {
    setTimeout(() => {
      tileNodes[index]?.classList.add('is-hinted');
      if (i > 0) playSound('connect-letter', i);
    }, i * 140);
  });

  const revealMs = hint.path.length * 140 + 1500;
  setTimeout(() => clearTileStates('is-hinted'), revealMs);

  ui.showToast(`Coba kata: ${hint.word}`, '', 'bulb');
}

/* ------------------------------------------------------------------ */
/* Shuffle                                                             */
/* ------------------------------------------------------------------ */

export function requestShuffle() {
  if (!state.isRunning) return;
  state.isPaused = true;
  ui.open({ ...ui.modals.shuffle(), onDismiss: unpause });
}

export async function applyShuffle() {
  ui.closeModal();
  unpause();

  resetSelection();
  playSound('shuffle');

  tileNodes.forEach((node, i) => {
    node.classList.remove('is-shuffling');
    void node.offsetWidth;
    node.style.animationDelay = `${i * 22}ms`;
    node.classList.add('is-shuffling');
  });

  const result = await api.requestShuffle(state.level.letters);

  // swap letters at the midpoint of the flip so the change is hidden
  setTimeout(() => {
    state.level.letters = result.letters;
    state.level.solutions = new Map(result.solutions.map((s) => [s.word, s.path]));
    updateTileLetters();
  }, 200);

  setTimeout(() => {
    tileNodes.forEach((n) => { n.classList.remove('is-shuffling'); n.style.animationDelay = ''; });
  }, 700);
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

export function bindBoard() {
  el.board.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    beginDrag(e);
  });
  el.board.addEventListener('pointermove', moveDrag);
  el.board.addEventListener('pointerup', endDrag);
  el.board.addEventListener('pointercancel', endDrag);
  el.board.addEventListener('lostpointercapture', endDrag);

  // keyboard play
  el.board.tabIndex = 0;
  el.board.addEventListener('keydown', handleBoardKey);
  el.board.addEventListener('focus', paintCursor);
  el.board.addEventListener('blur', () => tileNodes.forEach((n) => n.classList.remove('is-cursor')));

  // geometry must follow layout
  const remeasure = () => { measureBoard(); drawLines(); };
  window.addEventListener('resize', remeasure, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(remeasure, 220));

  if ('ResizeObserver' in window) {
    new ResizeObserver(remeasure).observe(el.board);
  }
}

/** Pause automatically when the tab is hidden — the timer must be fair. */
export function bindVisibility() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isRunning && !state.isPaused && !ui.isModalOpen()) {
      pauseGame();
    }
  });
}
