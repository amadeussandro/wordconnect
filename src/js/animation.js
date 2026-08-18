/**
 * animation.js — feedback effects.
 *
 * Everything here is transform/opacity only so it stays on the compositor,
 * and every effect self-cleans. Respects `prefers-reduced-motion`.
 */

const reduceMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Remove a node once its animation finishes (with a hard fallback). */
function autoRemove(node, ms) {
  const kill = () => node.remove();
  node.addEventListener('animationend', kill, { once: true });
  setTimeout(kill, ms);
}

/* ------------------------------------------------------------------ */
/* Floating score                                                      */
/* ------------------------------------------------------------------ */

/**
 * "+40 Bagus!" rising from the puzzle.
 * @param {HTMLElement} layer  positioned FX container
 * @param {{x:number,y:number}} at  coordinates relative to the layer
 */
export function floatScore(layer, at, points, label = '') {
  if (!layer) return;
  const el = document.createElement('div');
  el.className = 'fx-score';
  el.style.left = `${at.x}px`;
  el.style.top = `${at.y}px`;
  el.textContent = label ? `${label} +${points}` : `+${points}`;
  layer.appendChild(el);
  autoRemove(el, 1400);
}

/* ------------------------------------------------------------------ */
/* Sparks                                                              */
/* ------------------------------------------------------------------ */

const SPARK_COLORS = ['#FF6A00', '#10893E', '#FFB067', '#003675'];

/** A small, restrained burst — 8 particles, no screen-wide fireworks. */
export function sparkBurst(layer, at, count = 8) {
  if (!layer || reduceMotion()) return;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 26 + Math.random() * 30;
    const bit = document.createElement('span');
    bit.className = 'fx-spark';
    bit.style.left = `${at.x}px`;
    bit.style.top = `${at.y}px`;
    bit.style.background = SPARK_COLORS[i % SPARK_COLORS.length];
    bit.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    bit.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    bit.style.animationDelay = `${i * 12}ms`;
    layer.appendChild(bit);
    autoRemove(bit, 1000);
  }
}

/* ------------------------------------------------------------------ */
/* Confetti (win modal)                                                */
/* ------------------------------------------------------------------ */

const CONFETTI_COLORS = ['#FF6A00', '#003675', '#FFB067', '#10893E', '#FFD9BC'];

export function confetti(pieces = 44) {
  if (reduceMotion()) return () => {};

  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < pieces; i++) {
    const bit = document.createElement('i');
    bit.className = 'confetti__bit';
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    bit.style.setProperty('--dx', `${(Math.random() - 0.5) * 220}px`);
    bit.style.setProperty('--rot', `${360 + Math.random() * 720}deg`);
    bit.style.setProperty('--dur', `${2200 + Math.random() * 1500}ms`);
    bit.style.setProperty('--delay', `${Math.random() * 500}ms`);
    if (i % 3 === 0) bit.style.borderRadius = '50%';
    layer.appendChild(bit);
  }

  document.body.appendChild(layer);
  const timer = setTimeout(() => layer.remove(), 4600);
  return () => { clearTimeout(timer); layer.remove(); };
}

/* ------------------------------------------------------------------ */
/* Count-up                                                            */
/* ------------------------------------------------------------------ */

/** Animate a number from 0 → target. Returns a cancel function. */
export function countUp(el, target, duration = 900) {
  if (!el) return () => {};
  if (reduceMotion() || target === 0) {
    el.textContent = String(target);
    return () => {};
  }

  let raf = 0;
  let settled = false;
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  const settle = () => {
    if (settled) return;
    settled = true;
    el.textContent = String(target);
  };

  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    if (settled) return;
    el.textContent = String(Math.round(target * ease(t)));
    if (t < 1) raf = requestAnimationFrame(step);
    else settle();
  };
  raf = requestAnimationFrame(step);

  // rAF is frozen in hidden/non-compositing tabs — the final number must
  // still be correct, so guarantee it on a timer regardless.
  const guard = setTimeout(settle, duration + 120);

  return () => { cancelAnimationFrame(raf); clearTimeout(guard); settle(); };
}

/* ------------------------------------------------------------------ */
/* Element pulse                                                       */
/* ------------------------------------------------------------------ */

/** Re-trigger a CSS class-based animation reliably. */
export function retrigger(el, className, ms = 500) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;           // force reflow so the animation restarts
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
}
