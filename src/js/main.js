/**
 * Word Connect — app controller (PD design).
 * Connect adjacent letters (H/V/diagonal, max 4) to form words; the backend
 * validates each word against the board's valid set.
 */
import { CwAPI, fmtClock } from './api.js';
import { IS_LOCAL } from './config.js';
import { getSmid, goToLogin } from './auth.js';
import {
  RULES, getTier, isGuest, isMember, setDevTier,
  hasPlaysLeftToday, recordPlay, canPlayLevel,
} from './membership.js';
import { Countdown } from './timer.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['loading', 'error', 'onboarding', 'game', 'leaderboard'];
const MODALS = ['modal-complete', 'modal-cara', 'modal-exit', 'modal-login', 'modal-subscribe'];
const MAX_LEN = 4;
const GRID_LEVELS = 10; // cosmetic level grid on the landing (one daily board plays underneath)

const game = {
  view: 'loading', smid: null, board: null, token: null,
  grid: [], rows: 3, cols: 3, totalWords: 0,
  found: new Set(), foundCount: 0,
  hintsUsed: 0, hintLimit: 0,
  countdown: null, completed: false, lastResult: null,
  path: [],        // [{r,c}]
  dragging: false,
};

/* ---------- screens ---------- */
function showScreen(n) { game.view = n; SCREENS.forEach((s) => $('screen-' + s).classList.toggle('is-active', s === n)); }
function openModal(id) { $(id).hidden = false; }
function closeModal(id) { $(id).hidden = true; }
function closeAllModals() { MODALS.forEach((m) => ($(m).hidden = true)); }
function showError(msg, title) { $('error-title').textContent = title || 'Ups'; $('error-message').textContent = msg; showScreen('error'); }
let toastTimer = null;
function toast(msg) {
  let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

/* ---------- boot ---------- */
async function init() {
  initTheme();
  showScreen('loading');
  game.smid = getSmid();
  try { game.board = await CwAPI.today(); }
  catch (e) { if (e.httpStatus === 404) showError('Belum ada board untuk hari ini. Cek lagi nanti ya!', 'Belum Ada Board'); else showError(e.message); return; }
  game.grid = game.board.grid || [];
  game.rows = game.board.rows || game.grid.length;
  game.cols = game.board.cols || (game.grid[0] ? game.grid[0].length : 3);
  game.totalWords = game.board.total_words || 0;
  game.hintLimit = game.board.hint_limit || 0;
  refreshLanding();
  startCountdown();
  mountDevSwitcher();
  showScreen('onboarding');
}

/* ---------- landing (tier-aware) ---------- */
function refreshLanding() {
  $('board-teaser').textContent = 'Board ' + GRID_LEVELS + ', Telah Hadir!';
  const cta = document.querySelector('.play-cta');
  const free = !isMember() && !isGuest();
  const noPlays = free && !hasPlaysLeftToday(game.smid);
  if (cta) { cta.classList.toggle('is-locked', noPlays); cta.textContent = noPlays ? 'Sudah main hari ini' : 'Main Sekarang'; }
  renderLevelCards();
}

function renderLevelCards() {
  const wrap = $('level-cards');
  if (!wrap) return;
  wrap.innerHTML = '';
  const lockSvg = '<svg class="lock-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V8a6 6 0 0 1 12 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1zm2 0h8V8a4 4 0 0 0-8 0v2z" fill="currentColor"/></svg>';
  for (let i = 1; i <= GRID_LEVELS; i++) {
    const locked = !canPlayLevel(i - 1);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'level-card' + (locked ? ' locked' : '');
    card.innerHTML =
      '<span class="stars"><span class="off">★</span><span class="off">★</span><span class="off">★</span></span>' +
      '<span class="lbl">' + (locked ? lockSvg : '') + 'Board ' + i + '</span>';
    card.addEventListener('click', () => (locked ? openSubscribe('level') : requestPlay()));
    wrap.appendChild(card);
  }
}

function startCountdown() {
  const el = $('countdown');
  if (!el) return;
  const tick = () => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    let s = Math.max(0, Math.floor((end - now) / 1000));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); const sec = s - m * 60;
    el.textContent = h + 'j ' + String(m).padStart(2, '0') + 'm ' + String(sec).padStart(2, '0') + 'd';
  };
  tick();
  clearInterval(game._cdTimer);
  game._cdTimer = setInterval(tick, 1000);
}

/* ---------- access gate ---------- */
function requestPlay() {
  closeAllModals(); // close any open modal (e.g. the complete modal when restarting via its X)
  if (RULES.loginRequiredToPlay && isGuest()) { openModal('modal-login'); return; }
  if (!isMember() && !hasPlaysLeftToday(game.smid)) { openSubscribe('limit'); return; }
  startGame();
}

function openSubscribe(reason) {
  if (reason === 'limit') {
    $('sub-pill').textContent = 'Batas main harian';
    $('sub-title').textContent = 'Sudah main hari ini';
    $('sub-text').textContent = 'User gratis bisa main ' + RULES.freePlaysPerDay +
      'x per hari. Gabung Kompas.com+ MAX untuk main sepuasnya tanpa batas.';
  } else {
    $('sub-pill').textContent = 'Batas level khusus member';
    $('sub-title').textContent = 'Ingin main level sebelumnya?';
    $('sub-text').textContent = 'Gabung membership Kompas.com+ MAX untuk memainkan semua level game Kompas PLAY.';
  }
  $('sub-price').textContent = RULES.priceLabel;
  openModal('modal-subscribe');
}

function backToOnboarding() { closeAllModals(); refreshLanding(); showScreen('onboarding'); }

/* ---------- start ---------- */
async function startGame() {
  try { const res = await CwAPI.start(game.smid); game.token = res.attempt_token; game.totalWords = res.total_words || game.totalWords; }
  catch (e) { showError(e.message); return; }
  recordPlay(game.smid); // consume one of today's free plays (BE should also enforce)
  game.found = new Set(); game.foundCount = 0; game.hintsUsed = 0; game.completed = false; game.path = [];
  $('board-badge').textContent = (game.board.title || 'Board 1').replace('Connect Word', '').trim() || 'Board 1';
  $('board-badge').textContent = 'Board ' + (game.board.board_id || 1);
  $('found-total').textContent = game.totalWords;
  $('found-n').textContent = '0';
  $('hint-count').textContent = (game.hintLimit - game.hintsUsed) + 'x';
  document.querySelector('[data-action="hint"]').disabled = false;
  buildGrid();
  buildSlots();
  $('cw-feedback').innerHTML = '';
  showScreen('game');
  game.countdown = new Countdown(
    game.board.timer_seconds || 240,
    (s) => { $('timer-text').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); $('timer').classList.toggle('low', s <= 30); },
    () => { toast('Waktu habis!'); finish(); }
  );
  game.countdown.start();
}

/* ---------- grid ---------- */
function buildGrid() {
  const g = $('cw-grid');
  g.style.gridTemplateColumns = 'repeat(' + game.cols + ', 1fr)';
  g.style.gridTemplateRows = 'repeat(' + game.rows + ', 1fr)';
  g.innerHTML = '';
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r; cell.dataset.c = c;
      cell.textContent = game.grid[r][c];
      g.appendChild(cell);
    }
  }
  drawLines();
}

function buildSlots() {
  const s = $('found-slots'); s.innerHTML = '';
  for (let i = 0; i < game.totalWords; i++) {
    const d = document.createElement('div'); d.className = 'slot'; d.textContent = '· · ·'; d.dataset.i = i;
    s.appendChild(d);
  }
}

function cellEl(r, c) { return $('cw-grid').querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]'); }

function drawLines(state) {
  const svg = $('cw-lines');
  svg.setAttribute('viewBox', '0 0 100 100');
  const color = state === 'ok' ? getComputedStyle(document.documentElement).getPropertyValue('--ok') || '#16a34a'
    : state === 'bad' ? (getComputedStyle(document.documentElement).getPropertyValue('--bad') || '#dc2626')
    : (getComputedStyle(document.documentElement).getPropertyValue('--blue') || '#1b74c4');
  if (game.path.length < 2) { svg.innerHTML = ''; return; }
  const pts = game.path.map((p) => ((p.c + 0.5) / game.cols * 100) + ',' + ((p.r + 0.5) / game.rows * 100)).join(' ');
  svg.innerHTML = '<polyline points="' + pts + '" fill="none" stroke="' + color.trim() + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>';
}

/* ---------- path interaction ---------- */
function cellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const c = el.closest('.cell');
  if (!c || !$('cw-grid').contains(c)) return null;
  return { r: +c.dataset.r, c: +c.dataset.c };
}
function inPath(r, c) { return game.path.some((p) => p.r === r && p.c === c); }
function adjacent(a, b) { return Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1 && !(a.r === b.r && a.c === b.c); }

function pathAdd(r, c) {
  const last = game.path[game.path.length - 1];
  // backtrack
  if (game.path.length >= 2) {
    const prev = game.path[game.path.length - 2];
    if (prev.r === r && prev.c === c) { const popped = game.path.pop(); cellEl(popped.r, popped.c).classList.remove('active'); drawLines(); return; }
  }
  if (inPath(r, c)) return;
  if (last && !adjacent(last, { r, c })) return;
  if (game.path.length >= MAX_LEN) return;
  game.path.push({ r, c });
  cellEl(r, c).classList.add('active');
  drawLines();
}

function onDown(e) {
  if (game.completed) return;
  const cell = cellFromPoint(e.clientX, e.clientY);
  if (!cell) return;
  e.preventDefault();
  game.dragging = true;
  clearPath();
  pathAdd(cell.r, cell.c);
}
function onMove(e) {
  if (!game.dragging) return;
  const p = (e.touches && e.touches[0]) || e;
  const cell = cellFromPoint(p.clientX, p.clientY);
  if (cell) pathAdd(cell.r, cell.c);
}
function onUp() {
  if (!game.dragging) return;
  game.dragging = false;
  submitPath();
}
function clearPath() {
  game.path.forEach((p) => { const el = cellEl(p.r, p.c); if (el) el.classList.remove('active', 'ok', 'bad'); });
  game.path = [];
  drawLines();
}

async function submitPath() {
  if (game.path.length < 2) { clearPath(); return; }
  const word = game.path.map((p) => game.grid[p.r][p.c]).join('');
  const cells = game.path.slice();
  let res;
  try { res = await CwAPI.submitWord(game.token, word); }
  catch (e) { toast(e.message); clearPath(); return; }

  if (res.found) {
    cells.forEach((p) => { const el = cellEl(p.r, p.c); el.classList.remove('active'); el.classList.add('ok'); });
    drawLines('ok');
    const already = game.found.has(word.toUpperCase());
    if (!already) {
      game.found.add(word.toUpperCase());
      game.foundCount = res.found_count;
      $('found-n').textContent = game.foundCount;
      fillSlot(word.toUpperCase());
    }
    $('cw-feedback').innerHTML = '<span class="badge-benar">✓ Benar</span>';
    setTimeout(() => { clearPath(); $('cw-feedback').innerHTML = ''; if (game.foundCount >= game.totalWords) finish(); }, 700);
  } else {
    cells.forEach((p) => { const el = cellEl(p.r, p.c); el.classList.remove('active'); el.classList.add('bad'); });
    drawLines('bad');
    $('cw-feedback').innerHTML = '<span class="toast-bad">✕ Bukan Kata</span>';
    setTimeout(() => { clearPath(); $('cw-feedback').innerHTML = ''; }, 700);
  }
}

function fillSlot(word) {
  const slot = $('found-slots').querySelector('.slot:not(.filled)');
  if (slot) { slot.classList.add('filled'); slot.textContent = word; }
}

/* ---------- shuffle + hint ---------- */
function shuffle() {
  if (game.completed) return;
  // Shuffle letters of cells that are NOT part of already-found words is complex;
  // simplest: shuffle all letter positions (same letter set).
  const flat = [];
  for (let r = 0; r < game.rows; r++) for (let c = 0; c < game.cols; c++) flat.push(game.grid[r][c]);
  for (let i = flat.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [flat[i], flat[j]] = [flat[j], flat[i]]; }
  let k = 0;
  for (let r = 0; r < game.rows; r++) for (let c = 0; c < game.cols; c++) game.grid[r][c] = flat[k++];
  clearPath();
  buildGrid();
}

async function useHint() {
  if (game.hintsUsed >= game.hintLimit || game.completed) return;
  let res;
  try { res = await CwAPI.hint(game.token); }
  catch (e) { toast(e.message); return; }
  game.hintsUsed = res.hints_used; game.hintLimit = res.hint_limit;
  $('hint-count').textContent = (game.hintLimit - game.hintsUsed) + 'x';
  document.querySelector('[data-action="hint"]').disabled = game.hintsUsed >= game.hintLimit;
  // Auto-register the revealed word as found.
  if (res.word) {
    try {
      const sub = await CwAPI.submitWord(game.token, res.word);
      if (sub.found && !game.found.has(res.word.toUpperCase())) {
        game.found.add(res.word.toUpperCase());
        game.foundCount = sub.found_count;
        $('found-n').textContent = game.foundCount;
        fillSlot(res.word.toUpperCase());
        toast('Hint: ' + res.word.toUpperCase());
        if (game.foundCount >= game.totalWords) setTimeout(finish, 500);
      }
    } catch (e) { /* ignore */ }
  }
}

/* ---------- finish + leaderboard ---------- */
async function finish() {
  if (game.completed) return;
  game.completed = true;
  if (game.countdown) game.countdown.stop();
  let res;
  try { res = await CwAPI.complete(game.token); } catch (e) { showError(e.message); return; }
  game.lastResult = res;
  $('mc-sub').textContent = 'Kamu berhasil menyelesaikan Board ' + (game.board.board_id || 1);
  $('mc-time').textContent = fmtClock(res.duration_seconds);
  $('mc-hint').textContent = (res.hints_used || 0) + 'x';
  openModal('modal-complete');
}

async function openLeaderboard() {
  closeAllModals(); showScreen('leaderboard');
  const r = game.lastResult || {};
  $('lb-sub').textContent = 'Kamu telah menyelesaikan Word Connect Board ' + (game.board.board_id || 1);
  $('lb-time').textContent = fmtClock(r.duration_seconds);
  $('lb-hint').textContent = (r.hints_used || 0) + 'x';
  const loggedIn = !isGuest();
  $('lb-gate').hidden = loggedIn;
  $('lb-list').classList.toggle('blurred', !loggedIn);
  $('lb-note').hidden = !loggedIn;
  $('lb-list').innerHTML = '<li class="muted" style="text-align:center;padding:14px">Memuat…</li>';
  let data;
  try { data = await CwAPI.leaderboard(loggedIn ? game.smid : null); }
  catch (e) { $('lb-list').innerHTML = '<li class="muted" style="text-align:center;padding:14px">' + e.message + '</li>'; return; }
  // Keep the hero "Waktu kamu" in sync with the player's row on the board
  // (their best time this month — the value the leaderboard actually ranks on).
  if (loggedIn && data.my_rank) {
    $('lb-time').textContent = fmtClock(data.my_rank.time_taken);
    $('lb-hint').textContent = (data.my_rank.hints || 0) + 'x';
  }

  const rows = data.leaderboard || [];
  $('lb-list').innerHTML = '';
  rows.forEach((row) => $('lb-list').appendChild(lbItem(row, !!row.user_identifier && row.user_identifier === game.smid)));

  // Show the player's own row (with skeleton gaps) if they're outside the shown list.
  const meInList = rows.some((row) => row.user_identifier && row.user_identifier === game.smid);
  if (loggedIn && data.my_rank && !meInList) {
    $('lb-list').appendChild(skelRow());
    $('lb-list').appendChild(lbItem(data.my_rank, true));
    $('lb-list').appendChild(skelRow());
  }
  if (!rows.length && loggedIn && !data.my_rank) $('lb-list').innerHTML = '<li class="muted" style="text-align:center;padding:14px">Belum ada peringkat. Jadilah yang pertama!</li>';
}
const AVCOL = ['#ef4444', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981'];
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function skelRow() {
  const li = document.createElement('li');
  li.className = 'lb-skel';
  li.innerHTML = '<span class="lb-skel-dot"></span><span class="lb-skel-av"></span><span class="lb-skel-bar"></span>';
  return li;
}
function lbItem(r, isMe) {
  const li = document.createElement('li'); li.className = 'lb-item' + (isMe ? ' me' : '');
  const name = r.display_name || '—';
  const rankHtml = (r.rank_position >= 1 && r.rank_position <= 3)
    ? '<img class="lb-medal" src="assets/images/leaderboard/' + r.rank_position + '.svg" alt="#' + r.rank_position + '" />'
    : '<span class="lb-rank">' + r.rank_position + '</span>';
  li.innerHTML =
    rankHtml +
    '<span class="lb-av" style="background:' + AVCOL[(r.rank_position - 1) % AVCOL.length] + '">' + name.slice(0, 2).toUpperCase() + '</span>' +
    '<span class="lb-name">' + (isMe ? 'Kamu' : esc(name)) + '</span>' +
    '<span class="lb-stat"><small>Waktu</small><b>' + fmtClock(r.time_taken) + '</b></span>';
  return li;
}

/* ---------- theme ---------- */
const THEME_KEY = 'cw_theme';
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
function initTheme() { let t = null; try { t = localStorage.getItem(THEME_KEY); } catch (e) {} if (!t) t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'; applyTheme(t); }

/* ---------- events ---------- */
const actions = {
  play: requestPlay,
  how: () => openModal('modal-cara'),
  'close-cara': () => closeModal('modal-cara'),
  back: () => { if (game.view === 'game') openModal('modal-exit'); else backToOnboarding(); },
  stay: () => closeModal('modal-exit'),
  'confirm-exit': () => { closeAllModals(); backToOnboarding(); },
  shuffle, hint: useHint,
  'toggle-theme': () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'),
  'to-leaderboard': openLeaderboard,
  'to-onboarding': backToOnboarding,
  'play-again': requestPlay,
  login: goToLogin,
  'close-login': () => closeModal('modal-login'),
  join: () => { window.location.href = RULES.membershipUrl; },
  'close-subscribe': () => closeModal('modal-subscribe'),
  retry: () => location.reload(),
};
document.addEventListener('click', (e) => { const t = e.target.closest('[data-action]'); if (!t) return; const fn = actions[t.dataset.action]; if (fn) fn(); });
['modal-exit', 'modal-cara', 'modal-login', 'modal-subscribe'].forEach((id) => $(id).addEventListener('click', (e) => { if (e.target.id === id) closeModal(id); }));

/* Dev-only tier switcher so all three access states are testable on localhost. */
function mountDevSwitcher() {
  if (!IS_LOCAL || document.getElementById('dev-tier')) return;
  const bar = document.createElement('div');
  bar.id = 'dev-tier'; bar.className = 'dev-tier';
  bar.innerHTML = '<span>DEV</span>';
  ['guest', 'free', 'member'].forEach((tier) => {
    const b = document.createElement('button');
    b.textContent = tier; b.className = getTier() === tier ? 'on' : '';
    b.addEventListener('click', () => {
      setDevTier(tier);
      [...bar.querySelectorAll('button')].forEach((x) => x.classList.toggle('on', x.textContent === tier));
      refreshLanding();
    });
    bar.appendChild(b);
  });
  document.body.appendChild(bar);
}

// pointer path on the grid
const grid = $('cw-grid');
grid.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
grid.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });

init();
window.__cw = { game, startGame, finish, openLeaderboard, shuffle };
