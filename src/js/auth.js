/**
 * Kompas player login gate (logic mirrored from Berita Kuis / Rakit Kata).
 * Play is open; the leaderboard is login-gated. Local dev uses a persistent
 * dev smid so the logged-in path is testable.
 */
import { IS_LOCAL } from './config.js';
const LOGIN_URL = 'https://account.kompas.com';
const COOKIE_NAME = 'kmps_usrid';
const DEV_KEY = 'cw_dev_smid';

function getCookie(name) {
  const parts = ('; ' + document.cookie).split('; ' + name + '=');
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}
function devSmid() {
  let id = null; try { id = localStorage.getItem(DEV_KEY); } catch (_) {}
  if (!id) { id = 'dev_' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem(DEV_KEY, id); } catch (_) {} }
  return id;
}
export function getSmid() {
  const c = getCookie(COOKIE_NAME);
  if (c && c !== 'undefined' && c !== 'null') return c;
  if (IS_LOCAL) return devSmid();
  return null;
}
export function isLoggedIn() { return getSmid() !== null; }
export function goToLogin() { window.location.href = LOGIN_URL; }
