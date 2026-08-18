/**
 * ui.js — rendering + shell interactions.
 *
 * Owns the DOM: screen switching, level grid, level info, HUD, found-word
 * list, modals (with focus management) and toasts. It reads from
 * `gameState` but never mutates gameplay — that belongs to `game.js`.
 */

import { state, SCREENS } from './gameState.js';
import { icon, mountIcons } from './icons.js';
import { playSound } from './audio.js';
import { countUp, confetti, retrigger } from './animation.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const el = {};

/** Cache every node the app touches, once. */
export function cacheDom() {
  Object.assign(el, {
    header: $('#app-header'),
    btnSound: $('#btn-sound'),
    btnHelp: $('#btn-help'),
    btnPause: $('#btn-pause'),

    screens: {
      [SCREENS.MENU]: $('#screen-menu'),
      [SCREENS.LEVELS]: $('#screen-levels'),
      [SCREENS.INFO]: $('#screen-info'),
      [SCREENS.GAME]: $('#screen-game'),
    },

    menuStats: $('#menu-stats'),
    cityscape: $('#cityscape'),

    levelGrid: $('#level-grid'),
    progressFill: $('#progress-fill'),
    progressLabel: $('#progress-label'),

    infoLevel: $('#info-level'),
    infoSub: $('#info-sub'),
    infoList: $('#info-list'),

    hudTime: $('#hud-time'),
    hudLevel: $('#hud-level'),
    hudScore: $('#hud-score'),
    hudBest: $('#hud-best'),
    hudWords: $('#hud-words'),
    goalFill: $('#goal-fill'),

    board: $('#board'),
    boardTiles: $('#board-tiles'),
    boardLines: $('#board-lines'),
    boardCurrent: $('#board-current'),
    fxLayer: $('#fx-layer'),

    hintCount: $('#hint-count'),
    wordsList: $('#words-list'),
    wordsMeter: $('#words-meter'),

    toastLayer: $('#toast-layer'),
    modalLayer: $('#modal-layer'),
    modal: $('#modal'),
  });
}

/* ================================================================== */
/* Screens                                                             */
/* ================================================================== */

export function showScreen(name) {
  Object.entries(el.screens).forEach(([key, node]) => {
    const active = key === name;
    node.classList.toggle('is-active', active);
    node.hidden = !active;
  });

  // the pause control only exists while playing
  el.btnPause.classList.toggle('is-hidden', name !== SCREENS.GAME);
  window.scrollTo(0, 0);
}

/** The currently-open modal's dismiss handler, if any. */
export function modalDismissHandler() {
  return activeModal?.onDismiss ?? null;
}

/** Win / game-over modals must be resolved by a button, never by a stray click. */
export function isDismissible() {
  return !!activeModal?.dismissible;
}

/* ================================================================== */
/* Header                                                              */
/* ================================================================== */

export function renderSoundButton() {
  const on = state.soundEnabled;
  el.btnSound.innerHTML = icon(on ? 'sound-on' : 'sound-off');
  el.btnSound.setAttribute('aria-pressed', String(on));
  el.btnSound.setAttribute('aria-label', on ? 'Matikan suara' : 'Nyalakan suara');
}

export function renderStaticIcons() {
  el.btnHelp.innerHTML = icon('help');
  el.btnPause.innerHTML = icon('pause');
  mountIcons(document);
}

/* ================================================================== */
/* Main menu                                                           */
/* ================================================================== */

const CITYSCAPE = `
<svg viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax slice" role="presentation">
  <g fill="#003675" opacity=".07">
    <path d="M0 260V186h44v-26h30v26h40v-52h34v52h52v-80h30v80h40v-40h44v40h48v-96h32v96h46v-58h36v58h50v-74h34v74h44v-34h40v34h52v-88h30v88h44v-46h38v46h46v-64h34v64h48v-30h42v30h50v-70h32v70h40v-42h44v42H0Z"/>
  </g>
  <g fill="#003675" opacity=".13">
    <path d="M0 260v-46h58v-30h28v30h56v-66h30v66h62v-38h36v38h64v-84h30v84h58v-52h34v52h60v-30h40v30h56v-72h30v72h62v-44h34v44h60v-26h42v26h60v-58h30v58h58v-34h42v34H0Z"/>
  </g>
  <g fill="#003675" opacity=".22">
    <path d="M0 260v-24h74v-34h32v34h78v-52h34v52h84v-28h38v28h80v-60h32v60h86v-40h36v40h82v-22h40v22h78v-46h32v46h74v-30h40v30H0Z"/>
  </g>
  <g stroke="#FF6A00" stroke-width="2.5" opacity=".5" fill="none" stroke-linecap="round">
    <path d="M232 150l58-34 62 30"/>
    <path d="M812 132l54 26 60-32"/>
  </g>
  <g fill="#FF6A00" opacity=".62">
    <circle cx="232" cy="150" r="5"/><circle cx="290" cy="116" r="5"/><circle cx="352" cy="146" r="5"/>
    <circle cx="812" cy="132" r="5"/><circle cx="866" cy="158" r="5"/><circle cx="926" cy="126" r="5"/>
  </g>
</svg>`;

export function renderMenu(totalLevels) {
  if (el.cityscape && !el.cityscape.firstElementChild) el.cityscape.innerHTML = CITYSCAPE;

  const done = state.completed.size;
  el.menuStats.innerHTML = `
    <div class="menu__stat"><b>${done}<span style="opacity:.35">/${totalLevels}</span></b><span>Level</span></div>
    <div class="menu__stat menu__stat--accent"><b>${state.totalBest.toLocaleString('id-ID')}</b><span>Total Skor</span></div>
  `;
}

/* ================================================================== */
/* Level selection                                                     */
/* ================================================================== */

const STATUS_LABEL = { new: 'Main', current: 'Lanjut', done: 'Selesai', locked: 'Terkunci' };

export function renderLevelGrid(levels) {
  el.levelGrid.innerHTML = levels
    .map(({ id }) => {
      const status = state.statusOf(id);
      const locked = status === 'locked';
      const best = state.best[id] || 0;

      const mark =
        status === 'done' ? `<span class="level-card__mark">${icon('check-circle')}</span>`
        : locked ? `<span class="level-card__mark">${icon('lock')}</span>`
        : status === 'current' ? `<span class="level-card__mark">${icon('play')}</span>`
        : '';

      return `
        <button type="button" role="listitem"
                class="level-card level-card--${status}${locked ? ' is-locked' : ''}"
                data-action="pick-level" data-level="${id}"
                aria-label="Level ${id}${locked ? ', terkunci' : status === 'done' ? `, selesai, skor terbaik ${best}` : ''}">
          ${mark}
          <span class="level-card__num">${id}</span>
          <span class="level-card__meta">${status === 'done' && best ? best : STATUS_LABEL[status]}</span>
        </button>`;
    })
    .join('');

  const done = state.completed.size;
  const pct = Math.round((done / levels.length) * 100);
  el.progressFill.style.width = `${pct}%`;
  el.progressLabel.innerHTML = `<b>${done}</b> dari <b>${levels.length}</b> level selesai · Total skor <b>${state.totalBest.toLocaleString('id-ID')}</b>`;
}

/* ================================================================== */
/* Level info                                                          */
/* ================================================================== */

const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
export { fmtTime };

export function renderLevelInfo(cfg) {
  el.infoLevel.textContent = `Level ${cfg.id}`;
  el.infoSub.textContent = cfg.id === 1 ? 'Mulai petualangan katamu!' : 'Semakin menantang!';

  const best = state.best[cfg.id] || 0;
  const rows = [
    ['Target Kata', cfg.targetWords, 'target'],
    ['Waktu', fmtTime(cfg.timeLimit), 'clock'],
    ['Skor Target', cfg.targetScore.toLocaleString('id-ID'), 'star'],
    ['Papan', `${cfg.rows} × ${cfg.cols}`, 'spark'],
  ];
  if (best) rows.push(['Skor Terbaikmu', best.toLocaleString('id-ID'), 'trophy']);

  el.infoList.innerHTML =
    rows.map(([label, value]) => `
      <div class="info-list__row"><dt>${label}</dt><dd>${value}</dd></div>
    `).join('') +
    (cfg.bonus ? `<div class="info-list__row info-list__row--bonus"><dt>Bonus</dt><dd>${cfg.bonus}</dd></div>` : '');
}

/* ================================================================== */
/* Gameplay HUD                                                        */
/* ================================================================== */

export function renderHud() {
  el.hudLevel.textContent = state.level.levelId ?? '—';
  el.hudScore.textContent = state.score;
  el.hudBest.textContent = state.bestForCurrentLevel;
  el.hudWords.textContent = `${state.foundWords.size}/${state.level.targetWords}`;
  el.hintCount.textContent = state.hintsRemaining;
  el.wordsMeter.textContent = `${state.foundWords.size} / ${state.level.targetWords}`;
  el.goalFill.style.width = `${state.progressRatio * 100}%`;

  const btnHint = $('[data-action="hint"]');
  if (btnHint) btnHint.disabled = state.hintsRemaining <= 0;
}

export function renderTimer() {
  const t = Math.max(0, Math.ceil(state.timeRemaining));
  el.hudTime.textContent = fmtTime(t);
  el.hudTime.classList.toggle('is-urgent', t <= 10 && t > 0 && state.isRunning);
}

export function bumpScore() {
  retrigger(el.hudScore, 'is-bumped', 460);
}

/* ================================================================== */
/* Found words                                                         */
/* ================================================================== */

export function renderFoundWords() {
  const found = [...state.foundWords.entries()];
  const blanks = Math.max(0, state.level.targetWords - found.length);

  el.wordsList.innerHTML =
    found.map(([word, points]) => `
      <li class="word-pill">${word}<span class="word-pill__score">+${points}</span></li>
    `).join('') +
    Array.from({ length: Math.min(blanks, 10) }, () =>
      `<li class="word-pill word-pill--empty" aria-hidden="true">• • •</li>`
    ).join('');
}

/* ================================================================== */
/* Current-word chip                                                   */
/* ================================================================== */

export function renderCurrentWord(word, variant = '', note = '') {
  if (!word) { el.boardCurrent.innerHTML = ''; return; }
  el.boardCurrent.innerHTML =
    `<span class="word-chip${variant ? ` word-chip--${variant}` : ''}">${word}` +
    `${note ? `<span class="word-chip__note">${note}</span>` : ''}</span>`;
}

/* ================================================================== */
/* Toasts                                                              */
/* ================================================================== */

export function showToast(message, type = '', iconName = '') {
  const node = document.createElement('div');
  node.className = `toast${type ? ` toast--${type}` : ''}`;
  node.innerHTML =
    (iconName ? `<span class="toast__icon">${icon(iconName)}</span>` : '') +
    `<span>${message}</span>`;
  el.toastLayer.appendChild(node);

  setTimeout(() => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 240);
  }, 1900);
}

/* ================================================================== */
/* Modals                                                              */
/* ================================================================== */

let activeModal = null;
let lastFocused = null;
let stopConfetti = null;

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function trapFocus(event) {
  if (event.key !== 'Tab' || !activeModal) return;
  const nodes = $$(FOCUSABLE, el.modal).filter((n) => !n.disabled && n.offsetParent !== null);
  if (nodes.length === 0) return;

  const first = nodes[0];
  const last = nodes[nodes.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
}

function onModalKeydown(event) {
  if (event.key === 'Escape' && activeModal?.dismissible) {
    event.preventDefault();
    const onDismiss = activeModal.onDismiss;   // capture before closeModal clears it
    closeModal();
    onDismiss?.();
    return;
  }
  trapFocus(event);
}

/**
 * Open a modal.
 * @param {{id:string, html:string, dismissible?:boolean, onMount?:Function, onDismiss?:Function}} config
 */
export function openModal(config) {
  lastFocused = document.activeElement;
  activeModal = { dismissible: true, ...config };

  el.modal.innerHTML = config.html;
  el.modal.dataset.modal = config.id;
  el.modalLayer.hidden = false;
  el.modalLayer.classList.remove('is-closing');
  mountIcons(el.modal);

  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onModalKeydown);

  const focusTarget = $('[data-autofocus]', el.modal) || $$(FOCUSABLE, el.modal)[0];
  focusTarget?.focus({ preventScroll: true });

  config.onMount?.(el.modal);
  return el.modal;
}

export function closeModal() {
  if (!activeModal) return;
  const wasId = activeModal.id;
  activeModal = null;

  document.removeEventListener('keydown', onModalKeydown);
  el.modalLayer.classList.add('is-closing');

  if (stopConfetti) { stopConfetti(); stopConfetti = null; }

  setTimeout(() => {
    el.modalLayer.hidden = true;
    el.modalLayer.classList.remove('is-closing');
    el.modal.innerHTML = '';
    delete el.modal.dataset.modal;
    document.body.style.overflow = '';
    lastFocused?.focus?.({ preventScroll: true });
  }, 180);

  return wasId;
}

export function isModalOpen() {
  return activeModal !== null;
}

export function currentModalId() {
  return activeModal?.id ?? null;
}

/* ---------------- modal builders ---------------- */

const closeBtn = `<button class="modal__close" type="button" data-action="close-modal" aria-label="Tutup">${icon('close')}</button>`;

export const modals = {
  howto: () => ({
    id: 'howto',
    html: `
      ${closeBtn}
      <h3 class="modal__title" id="modal-title">Cara Bermain</h3>
      <p class="modal__text">Hubungkan huruf yang berdekatan untuk membentuk kata dalam Bahasa Indonesia.</p>
      <div class="howto__list">
        ${[
          ['Tekan &amp; seret', 'Tekan huruf pertama, lalu seret melewati huruf berikutnya. Lepaskan untuk mengirim kata.'],
          ['Harus berdekatan', 'Huruf harus bersebelahan — mendatar, menurun, atau diagonal. Tidak boleh melompat.'],
          ['Kata minimal 3 huruf', 'Semakin panjang katanya, semakin besar skornya.'],
          ['Kejar target', 'Temukan sejumlah kata sebelum waktu habis untuk menyelesaikan level.'],
        ].map(([h, p], i) => `
          <div class="howto__item">
            <span class="howto__num">${i + 1}</span>
            <div class="howto__body"><h4>${h}</h4><p>${p}</p></div>
          </div>`).join('')}
      </div>
      <div class="howto__scores">
        ${[['3 huruf', 20], ['4 huruf', 30], ['5 huruf', 40], ['6+ huruf', 60]]
          .map(([label, pts]) => `<div class="howto__score"><b>+${pts}</b><span>${label}</span></div>`).join('')}
      </div>
      <div class="modal__actions">
        <button class="btn btn--primary" type="button" data-action="close-modal" data-autofocus>Mengerti</button>
      </div>`,
    wide: true,
  }),

  pause: () => ({
    id: 'pause',
    dismissible: true,
    html: `
      ${closeBtn}
      <div class="modal__icon">${icon('pause')}</div>
      <h3 class="modal__title" id="modal-title">Jeda</h3>
      <p class="modal__text">Waktu dihentikan. Lanjutkan kapan saja.</p>
      <div class="modal__menu">
        <button class="modal__menu-item modal__menu-item--primary" type="button" data-action="resume" data-autofocus>
          <span class="modal__menu-item__icon">${icon('play')}</span>Lanjutkan
        </button>
        <button class="modal__menu-item" type="button" data-action="restart">
          <span class="modal__menu-item__icon">${icon('restart')}</span>Ulangi Level
        </button>
        <button class="modal__menu-item" type="button" data-action="request-exit">
          <span class="modal__menu-item__icon">${icon('home')}</span>Keluar ke Menu
        </button>
      </div>`,
  }),

  exit: () => ({
    id: 'exit',
    html: `
      ${closeBtn}
      <div class="modal__icon modal__icon--danger">${icon('alert')}</div>
      <h3 class="modal__title" id="modal-title">Keluar Level?</h3>
      <p class="modal__text">Progres di level ini akan hilang. Yakin ingin keluar?</p>
      <div class="modal__actions modal__actions--row">
        <button class="btn btn--ghost" type="button" data-action="cancel-exit" data-autofocus>Batal</button>
        <button class="btn btn--primary" type="button" data-action="confirm-exit">Keluar</button>
      </div>`,
  }),

  hint: (remaining) => ({
    id: 'hint',
    html: `
      ${closeBtn}
      <div class="modal__icon modal__icon--accent">${icon('bulb')}</div>
      <h3 class="modal__title" id="modal-title">Gunakan Hint?</h3>
      <p class="modal__text">Hint akan menyorot jalur satu kata yang belum kamu temukan.</p>
      <div class="hint-row">Sisa hint <b>${remaining}</b></div>
      <div class="modal__actions modal__actions--row">
        <button class="btn btn--ghost" type="button" data-action="close-modal">Batal</button>
        <button class="btn btn--primary" type="button" data-action="confirm-hint" data-autofocus>Gunakan</button>
      </div>`,
  }),

  shuffle: () => ({
    id: 'shuffle',
    html: `
      ${closeBtn}
      <div class="modal__icon modal__icon--accent">${icon('shuffle')}</div>
      <h3 class="modal__title" id="modal-title">Acak Huruf?</h3>
      <p class="modal__text">Mengacak huruf akan mereset pilihan yang sedang dibuat. Kata yang sudah ditemukan tetap aman.</p>
      <div class="modal__actions modal__actions--row">
        <button class="btn btn--ghost" type="button" data-action="close-modal">Batal</button>
        <button class="btn btn--primary" type="button" data-action="confirm-shuffle" data-autofocus>Acak</button>
      </div>`,
  }),

  locked: (id) => ({
    id: 'locked',
    html: `
      ${closeBtn}
      <div class="modal__icon">${icon('lock')}</div>
      <h3 class="modal__title" id="modal-title">Level Terkunci</h3>
      <p class="modal__text">Selesaikan level ${id - 1} terlebih dahulu untuk membuka level ${id}.</p>
      <div class="modal__actions">
        <button class="btn btn--primary" type="button" data-action="close-modal" data-autofocus>Oke</button>
      </div>`,
  }),

  win: ({ levelId, score, words, timeLeft, isRecord, isLast }) => ({
    id: 'win',
    dismissible: false,
    html: `
      <div class="modal__icon modal__icon--trophy">${icon('trophy')}</div>
      ${isRecord ? `<div class="best-badge">${icon('star')}Skor Terbaik Baru</div>` : ''}
      <h3 class="modal__title" id="modal-title">Hebat!</h3>
      <p class="modal__text">Level ${levelId} selesai${isLast ? ' — kamu menuntaskan semua level!' : ''}</p>
      <div class="modal__score">
        <div class="modal__score-label">Skor Anda</div>
        <div class="modal__score-value" data-countup="${score}">0</div>
      </div>
      <div class="modal__stats">
        <div class="modal__stat"><b>${words}</b><span>Kata</span></div>
        <div class="modal__stat"><b>${fmtTime(timeLeft)}</b><span>Sisa Waktu</span></div>
      </div>
      <div class="modal__actions">
        <button class="btn btn--primary btn--lg" type="button" data-action="next-level" data-autofocus>
          ${isLast ? 'Selesai' : 'Lanjut'}
        </button>
        <button class="btn btn--ghost" type="button" data-action="exit-to-menu">Kembali ke Menu</button>
      </div>`,
    onMount(root) {
      stopConfetti = confetti(48);
      countUp($('[data-countup]', root), score, 1000);
    },
  }),

  newbest: ({ score }) => ({
    id: 'newbest',
    dismissible: false,
    html: `
      <div class="best-badge">${icon('star')}New Best</div>
      <h3 class="modal__title" id="modal-title">Skor Terbaik Baru!</h3>
      <p class="modal__text">Kamu memecahkan rekor pribadimu di level ini.</p>
      <div class="modal__score">
        <div class="modal__score-label">Rekor Baru</div>
        <div class="modal__score-value" data-countup="${score}">0</div>
      </div>
      <div class="modal__actions">
        <button class="btn btn--primary btn--lg" type="button" data-action="after-newbest" data-autofocus>Lanjut</button>
      </div>`,
    onMount(root) {
      countUp($('[data-countup]', root), score, 900);
    },
  }),

  gameover: ({ score, words, target, isRecord }) => ({
    id: 'gameover',
    dismissible: false,
    html: `
      <div class="modal__icon modal__icon--danger">${icon('clock')}</div>
      ${isRecord ? `<div class="best-badge">${icon('star')}Skor Terbaik Baru</div>` : ''}
      <h3 class="modal__title" id="modal-title">Waktu Habis!</h3>
      <p class="modal__text">Jangan menyerah, coba lagi!</p>
      <div class="modal__score">
        <div class="modal__score-label">Skor Anda</div>
        <div class="modal__score-value" data-countup="${score}">0</div>
      </div>
      <div class="modal__stats">
        <div class="modal__stat"><b>${words} / ${target}</b><span>Kata</span></div>
        <div class="modal__stat"><b>${Math.round((words / Math.max(1, target)) * 100)}%</b><span>Target</span></div>
      </div>
      <div class="modal__actions">
        <button class="btn btn--primary btn--lg" type="button" data-action="retry" data-autofocus>Ulangi</button>
        <button class="btn btn--ghost" type="button" data-action="exit-to-menu">Keluar ke Menu</button>
      </div>`,
    onMount(root) {
      countUp($('[data-countup]', root), score, 900);
    },
  }),
};

/** Open one of the registered modals by builder result. */
export function open(builderResult) {
  const modal = openModal(builderResult);
  el.modal.classList.toggle('modal--wide', !!builderResult.wide);
  return modal;
}

export { $, $$ };
