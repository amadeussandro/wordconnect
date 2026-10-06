/**
 * Membership / access-gating seam for Kompas Play games.
 *
 * Three tiers decide what a player can do:
 *   - 'guest'  : not logged in            → must log in before playing
 *   - 'free'   : logged in, no membership → latest level only, limited plays/day
 *   - 'member' : Kompas.com+ MAX          → everything unlocked, unlimited plays
 *
 * This file is the SINGLE place the product rules live — kept identical across
 * games so gating behaves the same everywhere. Only GAME_KEY changes per game
 * (it namespaces the per-day quota in localStorage). The dev tier override is a
 * SHARED key, so a simulated tier applies across the whole ecosystem.
 *
 * Where the tier comes from:
 *   - 'guest' whenever there is no smid (see auth.js).
 *   - In production the free/member split should come from the SSO/BE (a cookie
 *     like `kmps_member`, or a field on the `today`/profile API). That wiring is a
 *     TODO — until then production treats every logged-in player as 'free'.
 *   - On localhost a dev override (localStorage `kompasplay_dev_tier`) lets us test
 *     all three states; the floating dev switcher in main.js sets it.
 */
import { IS_LOCAL } from './config.js';
import { getSmid } from './auth.js';

/* ----- Product rules (tweak here) ------------------------------------------ */
export const RULES = {
  loginRequiredToPlay: true,   // guests must log in before the game starts
  freePlaysPerDay: 1,          // free users: plays allowed per day, per game
  freeUnlockedLevels: 2,       // free users can play the first N levels; rest = member-only
  membershipUrl: 'https://www.kompas.com/plus', // TODO: confirm real join URL
  priceLabel: 'Rp29.000/bulan atau Rp139.000/tahun',
};

const GAME_KEY = 'cw';               // per-game namespace for the daily quota
const TIER_KEY = 'kompasplay_dev_tier'; // dev override only (localhost), shared across games

/** Current access tier: 'guest' | 'free' | 'member'. */
export function getTier() {
  if (IS_LOCAL) {
    // Dev override wins so we can simulate guest even though localhost always has
    // a persistent dev smid (see auth.js).
    let o = null;
    try { o = localStorage.getItem(TIER_KEY); } catch (_) {}
    if (o === 'guest' || o === 'free' || o === 'member') return o;
    return getSmid() ? 'free' : 'guest';
  }
  if (!getSmid()) return 'guest';
  // TODO(production): read membership from SSO cookie / BE profile flag.
  return 'free';
}

/** Dev only: set/clear the simulated tier (used by the localhost switcher). */
export function setDevTier(tier) {
  try {
    if (tier) localStorage.setItem(TIER_KEY, tier);
    else localStorage.removeItem(TIER_KEY);
  } catch (_) {}
}

export const isGuest  = () => getTier() === 'guest';
export const isMember = () => getTier() === 'member';

/* ----- Daily play quota (free users) --------------------------------------- */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function quotaKey(smid) { return 'play_' + GAME_KEY + '_' + smid + '_' + todayStr(); }

/** Plays the player still has today (Infinity for members). */
export function playsLeftToday(smid) {
  if (isMember()) return Infinity;
  if (!smid) return RULES.freePlaysPerDay;
  let used = 0;
  try { used = parseInt(localStorage.getItem(quotaKey(smid)) || '0', 10) || 0; } catch (_) {}
  return Math.max(0, RULES.freePlaysPerDay - used);
}

export function hasPlaysLeftToday(smid) { return playsLeftToday(smid) > 0; }

/** Consume one of today's plays. No-op for members. The BE should also enforce this. */
export function recordPlay(smid) {
  if (isMember() || !smid) return;
  try {
    const k = quotaKey(smid);
    const used = parseInt(localStorage.getItem(k) || '0', 10) || 0;
    localStorage.setItem(k, String(used + 1));
  } catch (_) {}
}

/* ----- Level access -------------------------------------------------------- */
/** Can this player start the given level? (0-based idx) */
export function canPlayLevel(levelIdx) {
  if (isMember()) return true;
  return levelIdx < RULES.freeUnlockedLevels;
}

/** How many of `total` levels this player may actually play. */
export function unlockedLevelCount(total) {
  return isMember() ? total : Math.min(total, RULES.freeUnlockedLevels);
}
