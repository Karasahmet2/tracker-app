// =========================================================
// Start-up and pages. Each page has an address:
//   #/water       Today (bottles, cups)
//   #/water/log   Today's log
//   #/running     Running (coming next)
//   #/calendar/month|week|day/YYYY-MM-DD   Calendar
// =========================================================
import { load, onChange, state } from './state.js';
import { $, dayKey, handleBack, isSheetOpen, showToast } from './ui.js';
import { mountToday, mountLog } from './water.js';
import { mountCalendar } from './calendar.js';
import { applyTheme } from './themes.js';

const routes = {
  '/water': { tab: 'water', mount: mountToday },
  '/water/log': { tab: 'water', mount: mountLog },
  '/running': { tab: 'running', mount: (v) => comingSoon(v, 'Running', 'Log your runs and see distance and pace. This is the next update.') },
  '/calendar': { tab: 'calendar', mount: mountCalendar }      // takes /view/date after it
};

let page = null;          // { update, destroy } of the page on screen
let lastDay = dayKey(Date.now());

function comingSoon(view, title, text) {
  view.innerHTML = `<div class="soon"><h1>${title}</h1><p>${text}</p><a class="btn primary" href="#/water" style="display:flex;align-items:center;justify-content:center;padding:0 24px;text-decoration:none;margin-top:8px">Back to Water</a></div>`;
  return { update() {}, destroy() {} };
}

// Finds the page for the address. Anything after a known page is passed on,
// e.g. #/calendar/day/2026-11-17 → calendar page with ['day', '2026-11-17'].
function resolve() {
  const parts = (location.hash.replace(/^#/, '') || '/water').split('/').filter(Boolean);
  for (let n = parts.length; n > 0; n--) {
    const path = '/' + parts.slice(0, n).join('/');
    if (routes[path]) return { route: routes[path], params: parts.slice(n) };
  }
  return { route: routes['/water'], params: [] };
}

function show() {
  const { route, params } = resolve();
  if (page) page.destroy();
  page = route.mount($('view'), params);
  document.querySelectorAll('#nav [data-tab]').forEach((a) => {
    const on = a.dataset.tab === route.tab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.scrollTo(0, 0);
}

// Stamp every page's history entry with how deep we are, so back arrows know
// whether an app page is behind them.
function stampDepth() {
  const st = history.state;
  if (!st || st.depth == null) {
    const prev = Number(sessionStorage.getItem('depth') || 0);
    history.replaceState({ depth: location.hash ? prev + 1 : 0 }, '');
  }
  sessionStorage.setItem('depth', String(history.state.depth));
}

async function start() {
  try {
    await load();
  } catch (e) {
    $('view').innerHTML = `<div class="soon"><h1>Can't open saved data</h1><p>Your browser blocked storage. Try a normal (not private) window.</p></div>`;
    return;
  }
  applyTheme(state.settings.theme);
  onChange(() => { if ((document.documentElement.dataset.theme || 'midnight') !== state.settings.theme) applyTheme(state.settings.theme); });
  if (!location.hash) history.replaceState({ depth: 0 }, '', '#/water');
  else if (!history.state) history.replaceState({ depth: 0 }, '');
  sessionStorage.setItem('depth', String(history.state.depth));

  window.addEventListener('hashchange', () => { stampDepth(); show(); });
  // The phone's back gesture closes an open sheet first.
  window.addEventListener('popstate', () => { if (isSheetOpen()) handleBack(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isSheetOpen()) history.back(); });

  onChange(() => page && page.update());

  // New day at midnight, or when the app comes back to the front
  const checkDay = () => {
    const k = dayKey(Date.now());
    if (k !== lastDay) { lastDay = k; page && page.update(); }
  };
  setInterval(checkDay, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkDay(); page && page.update(); } });

  show();
  registerServiceWorker();
}

// Offline + updates: when a new version is installed the app refreshes itself once.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  let refreshed = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshed) return;
    refreshed = true;
    sessionStorage.setItem('justUpdated', '1');
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
  if (sessionStorage.getItem('justUpdated')) {
    sessionStorage.removeItem('justUpdated');
    import('./version.js').then(({ APP_VERSION }) => showToast(`Updated to ${APP_VERSION}`));
  }
}

start();
