/**
 * icons.js — inline SVG icon set (no icon-font, no emoji as UI).
 * All icons share a 24×24 viewBox and inherit `currentColor`.
 */

const S = (body, opts = {}) =>
  `<svg viewBox="0 0 24 24" fill="${opts.fill || 'none'}" stroke="${opts.stroke || 'currentColor'}" ` +
  `stroke-width="${opts.sw || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  'arrow-left': S('<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>'),
  'arrow-right': S('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
  close: S('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  play: S('<path d="M7 4.5v15l12-7.5-12-7.5Z"/>', { fill: 'currentColor', sw: 1.5 }),
  pause: S('<rect x="7" y="5" width="4" height="14" rx="1.2"/><rect x="13" y="5" width="4" height="14" rx="1.2"/>', {
    fill: 'currentColor', stroke: 'none',
  }),
  restart: S('<path d="M3 12a9 9 0 1 0 2.5-6.2"/><path d="M3 4v5h5"/>'),
  home: S('<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1V9.5"/>'),
  help: S('<circle cx="12" cy="12" r="9"/><path d="M9.2 9.2a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.5-2.8 4.3"/><path d="M12 17.6h.01"/>'),
  bulb: S('<path d="M9 18h6"/><path d="M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-3.7 11.8c.6.4 1 1.1 1 1.8V18h5.4v-1.9c0-.7.4-1.4 1-1.8A6.5 6.5 0 0 0 12 2.5Z"/>'),
  shuffle: S('<path d="M17 3.5 21 7l-4 3.5"/><path d="M17 13.5 21 17l-4 3.5"/><path d="M21 7h-4.2a4 4 0 0 0-3.3 1.8L9.5 15.2A4 4 0 0 1 6.2 17H3"/><path d="M3 7h3.2a4 4 0 0 1 3.3 1.8l.6.9"/><path d="M14 14.3l.5.9a4 4 0 0 0 3.3 1.8H21"/>'),
  lock: S('<rect x="4.5" y="10" width="15" height="10.5" rx="2.4"/><path d="M8 10V7.2a4 4 0 0 1 8 0V10"/>'),
  check: S('<path d="m4.5 12.5 5 5 10-11"/>'),
  'check-circle': S('<circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.8 2.8L16 9.4"/>'),
  trophy: S('<path d="M7 4h10v5.5a5 5 0 0 1-10 0V4Z"/><path d="M7 5.5H4.5v1.8A3.2 3.2 0 0 0 7.7 10.5"/><path d="M17 5.5h2.5v1.8a3.2 3.2 0 0 1-3.2 3.2"/><path d="M12 14.5V18"/><path d="M8.5 21h7"/><path d="M9.6 18h4.8l.6 3H9l.6-3Z"/>'),
  clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.2 1.9"/>'),
  target: S('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  star: S('<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.5 9.8l5.9-.8L12 3.6Z"/>'),
  spark: S('<path d="M12 3v4"/><path d="M12 17v4"/><path d="M4.9 7.1 7.8 10"/><path d="M16.2 14 19 16.9"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="M4.9 16.9 7.8 14"/><path d="M16.2 10 19 7.1"/>'),
  alert: S('<path d="M12 8.5v4.2"/><path d="M12 16.8h.01"/><path d="M10.3 3.9 2.6 17.3A2 2 0 0 0 4.3 20.3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>'),
  exit: S('<path d="M15 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H15"/><path d="M10 8 6 12l4 4"/><path d="M6 12h9"/>'),
  'sound-on': S('<path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"/><path d="M16 9a4.2 4.2 0 0 1 0 6"/><path d="M18.6 6.2a8 8 0 0 1 0 11.6"/>'),
  'sound-off': S('<path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"/><path d="m16.5 9.5 4 5"/><path d="m20.5 9.5-4 5"/>'),
};

/** Return raw SVG markup for an icon name. */
export function icon(name) {
  return ICONS[name] || '';
}

/** Hydrate every `[data-icon]` placeholder inside `root`. */
export function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.getAttribute('data-icon');
    if (name && !el.firstElementChild) el.innerHTML = icon(name);
  });
}
