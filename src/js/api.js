/**
 * Thin fetch wrappers for the Connect Word public API (api/cw/*).
 * Envelope: { status, data }. Throws Error(message) on failure (err.httpStatus set).
 */
import { API_BASE } from './config.js';

async function request(path, options = {}) {
  let res;
  try { res = await fetch(API_BASE + path, options); }
  catch (e) { throw new Error('Tidak dapat terhubung ke server.'); }
  let body = null;
  try { body = await res.json(); } catch (_) {}
  if (!body || typeof body.status === 'undefined') throw new Error('Respons server tidak valid (' + res.status + ').');
  if (body.status !== true) { const err = new Error(body.error || 'Terjadi kesalahan.'); err.httpStatus = res.status; throw err; }
  return body.data;
}
const apiGet = (p) => request(p, { method: 'GET' });
const apiPost = (p, d = {}) => request(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });

export const CwAPI = {
  today:       ()              => apiGet('today'),
  start:       (smid)          => apiPost('attempts', { user_identifier: smid }),
  submitWord:  (token, word)   => apiPost(`attempts/${token}/word`, { word }),
  hint:        (token)         => apiPost(`attempts/${token}/hint`, {}),
  complete:    (token)         => apiPost(`attempts/${token}/complete`, {}),
  result:      (token)         => apiGet(`attempts/${token}/result`),
  leaderboard: (smid)          => apiGet('leaderboard' + (smid ? '/' + encodeURIComponent(smid) : '') + '?limit=5'),
};
export function fmtClock(sec) { sec = Math.max(0, Math.floor(sec || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
