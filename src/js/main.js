/**
 * main.js — bootstrap + the single delegated action router.
 *
 * Every interactive control in the app declares `data-action="…"`, so
 * there is exactly one click listener for the whole product and no
 * per-render re-binding.
 */

import { state, SCREENS } from './gameState.js';
import * as api from './api.js';
import { TOTAL_LEVELS } from './levels.js';
import { setSoundEnabled, unlockAudio, playSound } from './audio.js';
import * as ui from './ui.js';
import * as game from './game.js';

let levelCatalogue = [];

/* ================================================================== */
/* Navigation                                                          */
/* ================================================================== */

function goMenu() {
  game.abandonLevel();
  ui.renderMenu(TOTAL_LEVELS);
  ui.showScreen(SCREENS.MENU);
  state.setScreen(SCREENS.MENU);
}

function goLevels() {
  game.abandonLevel();
  ui.renderLevelGrid(levelCatalogue);
  ui.showScreen(SCREENS.LEVELS);
  state.setScreen(SCREENS.LEVELS);
}

async function goLevelInfo(levelId) {
  state.pendingLevelId = levelId;
  const cfg = await api.fetchLevelInfo(levelId);
  ui.renderLevelInfo(cfg);
  ui.showScreen(SCREENS.INFO);
  state.setScreen(SCREENS.INFO);
}

function pickLevel(levelId) {
  if (!state.isLevelUnlocked(levelId)) {
    playSound('invalid-word');
    ui.open(ui.modals.locked(levelId));
    return;
  }
  playSound('button-click');
  goLevelInfo(levelId);
}

async function beginLevel(levelId) {
  try {
    await game.startLevel(levelId);
  } catch (error) {
    console.error('[WordConnect] gagal memuat level', error);
    ui.showToast('Gagal memuat level. Coba lagi.', 'error', 'alert');
    goLevels();
  }
}

/* ================================================================== */
/* Action router                                                       */
/* ================================================================== */

const ACTIONS = {
  /* ---- shell ---- */
  'go-menu': goMenu,
  'go-levels': goLevels,
  play: () => goLevels(),
  'open-howto': () => ui.open(ui.modals.howto()),

  'toggle-sound': () => {
    const next = !state.soundEnabled;
    state.setSound(next);
    setSoundEnabled(next);
    ui.renderSoundButton();
    if (next) playSound('button-click');
    ui.showToast(next ? 'Suara dinyalakan' : 'Suara dimatikan', '', next ? 'sound-on' : 'sound-off');
  },

  /* ---- modal chrome ---- */
  'close-modal': () => {
    const handler = ui.modalDismissHandler();
    ui.closeModal();
    handler?.();
  },
  'modal-backdrop': () => {
    if (!ui.isDismissible()) return;
    const handler = ui.modalDismissHandler();
    ui.closeModal();
    handler?.();
  },

  /* ---- level select ---- */
  'pick-level': (el) => pickLevel(Number(el.dataset.level)),
  'start-level': () => beginLevel(state.pendingLevelId),

  /* ---- in-game ---- */
  pause: () => game.pauseGame(),
  resume: () => game.resumeGame(),
  restart: () => game.restartLevel(),
  retry: () => game.retryLevel(),

  // exit is always reachable *back* to pause — never a dead end
  'request-exit': () => {
    ui.closeModal();
    setTimeout(() => ui.open({ ...ui.modals.exit(), onDismiss: () => game.showPauseModal() }), 200);
  },
  'cancel-exit': () => {
    ui.closeModal();
    setTimeout(() => game.showPauseModal(), 200);
  },
  'confirm-exit': () => {
    ui.closeModal();
    setTimeout(goMenu, 200);
  },
  'exit-to-menu': () => {
    ui.closeModal();
    setTimeout(goMenu, 200);
  },

  hint: () => game.requestHint(),
  'confirm-hint': () => game.applyHint(),
  shuffle: () => game.requestShuffle(),
  'confirm-shuffle': () => game.applyShuffle(),

  /* ---- endings ---- */
  'next-level': () => {
    const outcome = game.consumeWin();
    if (outcome === 'newbest') return;      // record modal takes over
    advance();
  },
  'after-newbest': () => {
    ui.closeModal();
    setTimeout(advance, 200);
  },
};

function advance() {
  const next = game.nextLevelId();
  ui.closeModal();
  setTimeout(() => {
    if (next && state.isLevelUnlocked(next)) goLevelInfo(next);
    else goLevels();
  }, 200);
}

/* ================================================================== */
/* Global listeners                                                    */
/* ================================================================== */

function bindGlobalEvents() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.dataset.action;
    const handler = ACTIONS[action];
    if (!handler) return;

    if (trigger.tagName === 'A') event.preventDefault();
    if (trigger.disabled) return;

    // audio may only start from a genuine user gesture
    unlockAudio();

    const silent = ['modal-backdrop', 'pick-level', 'toggle-sound'];
    if (!silent.includes(action)) playSound('button-click');

    handler(trigger, event);
  });

  // keyboard shortcuts while playing
  document.addEventListener('keydown', (event) => {
    if (ui.isModalOpen()) return;
    if (state.screen !== SCREENS.GAME) return;

    if (event.key === 'Escape' || event.key.toLowerCase() === 'p') {
      event.preventDefault();
      game.pauseGame();
    }
  });

  // first gesture anywhere unlocks the AudioContext
  ['pointerdown', 'keydown'].forEach((type) =>
    window.addEventListener(type, unlockAudio, { once: true, passive: true })
  );
}

/* ================================================================== */
/* Boot                                                                */
/* ================================================================== */

async function boot() {
  ui.cacheDom();
  ui.renderStaticIcons();
  ui.renderSoundButton();
  setSoundEnabled(state.soundEnabled);

  const catalogue = await api.fetchLevelList();
  levelCatalogue = catalogue.levels;

  ui.renderMenu(catalogue.total);
  ui.renderLevelGrid(levelCatalogue);

  game.bindBoard();
  game.bindVisibility();
  bindGlobalEvents();

  ui.showScreen(SCREENS.MENU);
  document.documentElement.classList.add('is-ready');
}

boot().catch((error) => {
  console.error('[WordConnect] gagal memulai', error);
});
