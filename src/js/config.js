/**
 * Runtime config for Connect Word. Backend = shared kompasplay_BE.
 * PROD_BASE path is a placeholder — confirm with the platform/PD team.
 */
const LOCAL_BASE = 'http://localhost/1.kompas/kompasplay_BE/';
const PROD_BASE  = 'https://play.kompas.com/kompas-games/crozword/'; // TODO: confirm path
function isLocalhost() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');
}
export const IS_LOCAL = isLocalhost();
export const API_BASE = (IS_LOCAL ? LOCAL_BASE : PROD_BASE) + 'api/cw/';
