// =========================================================
// Shared screen parts: helpers, icons, sheets (with back
// gesture + pull down to close), toasts and the banner.
// =========================================================

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- formatting ----------
export const pad = (n) => String(n).padStart(2, '0');
export const hhmm = (ts) => { const d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
export const minutesOf = (ts) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
export const dayKey = (ts) => { const d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const fmtMl = (ml) => ml >= 1000 ? +(ml / 1000).toFixed(2) + ' L' : Math.round(ml) + ' ml';
export const fmtL = (ml) => (ml / 1000).toFixed(2);
export const longDate = (ts = Date.now()) =>
  new Date(ts).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---------- icons ----------
export const icons = {
  cup: (size = 22, color = 'var(--water-light)') =>
    `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="stroke:${color}" stroke-width="2" stroke-linejoin="round"><path d="M5 4h14l-1.6 16.2a1 1 0 0 1-1 .8H7.6a1 1 0 0 1-1-.8z"/><path d="M6 10h12" stroke-opacity="0.5"/></svg>`,
  run: `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" style="stroke:currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="4" r="2"/><path d="m6 21 3-6 3 2v4M8 11l3-3 3 3 3 1M11 8l-1 5"/></svg>`,
  treadmill: `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" style="stroke:currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19h18"/><path d="M5 19 19 12"/><path d="M15 8h3l2 4"/></svg>`,
  slope: `<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" style="stroke:currentColor" stroke-width="3" stroke-linecap="round"><path d="M3 18 L21 8"/></svg>`,
  note: `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" style="stroke:currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h5"/></svg>`,
  backup: `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" style="stroke:var(--text-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>`,
  plus: `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  close: `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" style="stroke:var(--text-2)" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  back: `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" style="stroke:var(--text-2)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
  trash: `<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" style="stroke:var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`,
  sliders: `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" style="stroke:var(--text-2)" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2" style="fill:var(--surface)"/><circle cx="15" cy="12" r="2" style="fill:var(--surface)"/><circle cx="8" cy="18" r="2" style="fill:var(--surface)"/></svg>`,
  check: (color = 'var(--water-light)') => `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" style="stroke:${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`
};

// ---------- back navigation ----------
// The router stamps each page's history entry with its depth.
// A back arrow steps back if there's an app page behind it,
// otherwise it goes to the fallback page.
export function goBack(fallback = '/water') {
  if (history.state && history.state.depth > 0) history.back();
  else location.replace('#' + fallback);
}

// =========================================================
// Sheets
// One sheet at a time. Opening one adds a step to the phone's
// history, so the back gesture closes it instead of leaving.
// =========================================================
let sheetOpen = false;
let onCloseFn = null;

export function isSheetOpen() { return sheetOpen; }

export function openSheet(html, { onMount, onClose, label = 'Dialog' } = {}) {
  const slot = $('sheetSlot');
  const replacing = sheetOpen;
  slot.querySelector('.sheet')?._cleanup?.();
  slot.innerHTML = `<div class="overlay"><div class="backdrop" data-close></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="grabber" aria-hidden="true"></div>${html}</section></div>`;
  if (!replacing) history.pushState({ sheet: true }, '');
  sheetOpen = true;
  onCloseFn = onClose || null;
  const sheet = slot.querySelector('.sheet');
  slot.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => closeSheet()));
  enablePullDown(sheet);
  if (onMount) onMount(sheet);
  return sheet;
}

// Close from a button/backdrop: step back in history (popstate then closes it).
export function closeSheet() {
  if (!sheetOpen) return;
  if (history.state && history.state.sheet) history.back();
  else closeNow();
}

// Called by the app when the back gesture happens. Returns true if it closed a sheet.
export function handleBack() {
  if (!sheetOpen) return false;
  closeNow();
  return true;
}

function closeNow() {
  const slot = $('sheetSlot');
  const sheet = slot.querySelector('.sheet');
  sheetOpen = false;
  const fn = onCloseFn; onCloseFn = null;
  sheet?._cleanup?.();
  if (sheet) {
    sheet.classList.add('closing');
    slot.querySelector('.backdrop')?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    setTimeout(() => { if (!sheetOpen) slot.innerHTML = ''; }, 200);
  } else slot.innerHTML = '';
  if (fn) fn();
}

// Pull the sheet down to close it
function enablePullDown(sheet) {
  let startY = null, dy = 0;
  sheet.addEventListener('pointerdown', (e) => {
    if (sheet.scrollTop > 0 || e.target.closest('input, textarea, select')) return;
    startY = e.clientY; dy = 0;
  });
  const move = (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    if (dy > 6) { sheet.classList.add('dragging'); sheet.style.transform = `translateY(${dy}px)`; }
  };
  const up = () => {
    if (startY == null) return;
    startY = null;
    sheet.classList.remove('dragging');
    if (dy > 110) { sheet.style.transform = ''; closeSheet(); }
    else sheet.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' }).onfinish = () => { sheet.style.transform = ''; };
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: false });
  window.addEventListener('pointercancel', up);
  // listeners are cleaned up when the next sheet replaces this one
  sheet._cleanup = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
}

// =========================================================
// Toast (with optional Undo) and banner
// =========================================================
let toastTimer = null;
export function showToast(text, { undo, action, ms = 4500 } = {}) {
  clearTimeout(toastTimer);
  const btn = undo ? 'Undo' : action ? action.label : '';
  $('toastSlot').innerHTML = `<div class="toast" role="status"><span>${esc(text)}</span>${btn ? `<button type="button" data-undo>${esc(btn)}</button>` : ''}</div>`;
  if (btn) $('toastSlot').querySelector('[data-undo]').onclick = () => { hideToast(); (undo || action.fn)(); };
  toastTimer = setTimeout(hideToast, ms);
}
export function hideToast() { clearTimeout(toastTimer); $('toastSlot').innerHTML = ''; }

let bannerTimer = null;
export function showBanner(title, text) {
  clearTimeout(bannerTimer);
  $('bannerSlot').innerHTML = `<div class="banner" role="status">${icons.check()}<div><b>${esc(title)}</b><span>${esc(text)}</span></div></div>`;
  bannerTimer = setTimeout(() => { $('bannerSlot').innerHTML = ''; }, 4000);
}
