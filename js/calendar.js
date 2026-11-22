// =========================================================
// Calendar: Month, Week and Day pages for water.
// Addresses:  #/calendar/month/2026-11-17   (the month holding that date)
//             #/calendar/week/2026-11-17    (Monday–Sunday holding that date)
//             #/calendar/day/2026-11-17
// Days fill like the bottle; drinks past the goal show as "extra".
// =========================================================
import { state, drinksOn, goalFor } from './state.js';
import { $, esc, icons, hhmm, dayKey, fmtMl, fmtL } from './ui.js';
import { timelineHTML } from './water.js';

const VIEWS = ['day', 'week', 'month'];           // zoom order, most detailed first
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ---------- dates ----------
export const keyToDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const isKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k || '') && !isNaN(keyToDate(k));
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const mondayOf = (date) => addDays(date, -((date.getDay() + 6) % 7));
const todayKey = () => dayKey(Date.now());
const isFuture = (key) => key > todayKey();
const href = (view, key) => `#/calendar/${view}/${key}`;

// Totals for every day, worked out once per page draw
function totalsByDay() {
  const out = {};
  state.drinks.forEach((d) => { const k = dayKey(d.ts); out[k] = (out[k] || 0) + d.ml; });
  return out;
}

// One wave strip, reused for every fill
const WAVE = (fill) =>
  `<svg class="cwave" aria-hidden="true" viewBox="0 0 96 8" preserveAspectRatio="none"><path d="M0 4 Q6 0 12 4 T24 4 T36 4 T48 4 T60 4 T72 4 T84 4 T96 4 V8 H0Z" style="fill:${fill}"/></svg>`;

// =========================================================
// Page shell: title, Day/Week/Month switch, ‹ period ›
// =========================================================
function shell(view, key, { label, right, prevKey, nextKey }) {
  const tabs = ['day', 'week', 'month'];
  return `
    <header class="head">
      <div><div class="date">Water</div><h1>Calendar</h1></div>
      <span class="cal-hint">${view === 'day' ? 'Pinch in for the week' : 'Tap a day to open it'}</span>
    </header>
    <div class="zoom" role="tablist" aria-label="Zoom">
      ${tabs.map((v) => `<a href="${href(v, key)}" role="tab" aria-selected="${v === view}" class="${v === view ? 'on' : ''}" data-zoom="${v}">${v[0].toUpperCase() + v.slice(1)}</a>`).join('')}
    </div>
    <div class="period">
      <div class="period-nav">
        <a class="icon-btn ghost" href="${href(view, prevKey)}" aria-label="Previous ${view}" data-step="prev">${icons.back}</a>
        <span class="period-label" id="periodLabel">${esc(label)}</span>
        ${nextKey ? `<a class="icon-btn ghost flip" href="${href(view, nextKey)}" aria-label="Next ${view}" data-step="next">${icons.back}</a>`
                  : `<span class="icon-btn ghost flip disabled" aria-hidden="true">${icons.back}</span>`}
      </div>
      <span class="period-right">${esc(right)}</span>
    </div>
    <div class="cal-body" id="calBody"></div>
    <div class="legend">
      <span><i style="background:var(--water)"></i>Up to goal</span>
      <span><i style="background:var(--bonus)"></i>Extra</span>
      <span class="legend-tip">Pinch to zoom</span>
    </div>`;
}

// =========================================================
// Month
// =========================================================
function mountMonth(view, key) {
  const focus = keyToDate(key);
  const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const days = new Date(focus.getFullYear(), focus.getMonth() + 1, 0).getDate();
  const totals = totalsByDay();
  const today = todayKey();

  // average over days of this month up to today that are in the past or today
  const counted = [];
  for (let d = 1; d <= days; d++) { const k = dayKey(new Date(first.getFullYear(), first.getMonth(), d)); if (k <= today) counted.push(totals[k] || 0); }
  const avg = counted.length ? counted.reduce((a, b) => a + b, 0) / counted.length : 0;

  const prev = dayKey(new Date(first.getFullYear(), first.getMonth() - 1, 1));
  const nextFirst = new Date(first.getFullYear(), first.getMonth() + 1, 1);
  const next = dayKey(nextFirst) <= today ? dayKey(nextFirst) : null;

  view.innerHTML = shell('month', key, {
    label: first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    right: counted.length ? `Avg ${fmtL(avg)} L` : '',
    prevKey: prev, nextKey: next
  });

  const start = mondayOf(first);
  const rows = Math.ceil(((first.getDay() + 6) % 7 + days) / 7);
  let cells = '';
  for (let i = 0; i < rows * 7; i++) {
    const date = addDays(start, i);
    const k = dayKey(date);
    const other = date.getMonth() !== first.getMonth();
    const future = isFuture(k);
    const ml = totals[k] || 0;
    const { goal, bonus } = goalFor(k);                // each day keeps its own goal
    const pct = Math.min(100, ml / goal * 100);
    const ex = Math.max(0, Math.min(ml - goal, bonus));
    const delay = i * 30, fillMs = 500 + pct * 6;
    const cls = ['mcell', other && 'other', future && 'future', k === today && 'today', ml >= goal && 'full'].filter(Boolean).join(' ');
    const inner = `
        ${!future && ml ? `<div class="mfill" style="height:${pct.toFixed(1)}%;animation-duration:${fillMs}ms;animation-delay:${delay}ms">${WAVE('var(--water)')}</div>` : ''}
        ${ex ? `<div class="mextra" style="height:${(ex / bonus * 100).toFixed(1)}%;animation-delay:${delay + fillMs + 150}ms">${WAVE('var(--bonus)')}</div>` : ''}
        <span class="mnum" style="animation-delay:${delay + fillMs}ms">${date.getDate()}</span>`;
    const aria = `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, ${future ? 'not yet' : fmtMl(ml)}`;
    cells += future
      ? `<span class="${cls}" aria-label="${aria}" data-day="${k}">${inner}</span>`
      : `<a class="${cls}" href="${href('day', k)}" aria-label="${aria}" data-day="${k}" data-ml="${ml}">${inner}</a>`;
  }

  $('calBody').innerHTML = `
    <div class="mgrid weekdays">${WEEKDAYS.map((w) => `<span>${w.toUpperCase()}</span>`).join('')}</div>
    <div class="mgrid" id="monthGrid">${cells}</div>`;
  return { update: () => mountMonth(view, key), destroy() {} };
}

// =========================================================
// Week — 4 cards on top, 3 below, the 8th card is the summary
// =========================================================
function mountWeek(view, key) {
  const mon = mondayOf(keyToDate(key));
  const totals = totalsByDay();
  const today = todayKey();
  const sun = addDays(mon, 6);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const label = mon.getMonth() === sun.getMonth() ? `${mon.getDate()} – ${fmt(sun)}` : `${fmt(mon)} – ${fmt(sun)}`;

  const list = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), k = dayKey(d);
    list.push({ d, k, ml: totals[k] || 0, future: isFuture(k), ...goalFor(k) });
  }
  const past = list.filter((x) => !x.future);
  const sum = past.reduce((a, x) => a + x.ml, 0);
  const avg = past.length ? sum / past.length : 0;
  const atGoal = past.filter((x) => x.ml >= x.goal).length;
  const extra = past.reduce((a, x) => a + Math.max(0, x.ml - x.goal), 0);
  const nextMon = addDays(mon, 7);

  view.innerHTML = shell('week', key, {
    label, right: `${fmtL(sum)} L`,
    prevKey: dayKey(addDays(mon, -7)), nextKey: dayKey(nextMon) <= today ? dayKey(nextMon) : null
  });

  const card = (x, i) => {
    const { goal, bonus } = x;
    const pct = x.future ? 0 : Math.min(100, x.ml / goal * 100);
    const ex = x.future ? 0 : Math.max(0, Math.min(x.ml - goal, bonus));
    const delay = i * 140, fillMs = 700 + pct * 6;
    const cls = ['wcard', x.k === today && 'today', x.future && 'future', x.ml >= goal && 'full', ex && 'has-extra'].filter(Boolean).join(' ');
    const body = `
      <span class="wday">${WEEKDAYS[i]} ${x.d.getDate()}</span>
      <div class="wbottles">
        <div class="wbig"><i class="wcap"></i><i class="wneck"></i>
          <div class="wbody">${pct ? `<div class="wfill" style="height:${pct.toFixed(1)}%;animation-duration:${fillMs}ms;animation-delay:${delay}ms">${WAVE('var(--water)')}<i class="wshine"></i></div>` : ''}</div>
        </div>
        <div class="wbonus"><i class="wcap"></i><i class="wneck"></i>
          <div class="wbody">${ex ? `<div class="wfill" style="height:${(ex / bonus * 100).toFixed(1)}%;animation-delay:${delay + fillMs + 100}ms">${WAVE('var(--water)')}</div>` : ''}</div>
        </div>
      </div>
      <span class="wamt">${x.future ? '—' : fmtL(x.ml).replace(/0$/, '') + ' L'}${ex ? ` <b style="animation-delay:${delay + fillMs}ms">+${(ex / 1000).toFixed(1)}</b>` : ''}</span>`;
    const aria = `${x.d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, ${x.future ? 'not yet' : fmtMl(x.ml)}`;
    return x.future ? `<div class="${cls}" aria-label="${aria}" data-day="${x.k}">${body}</div>`
      : `<a class="${cls}" href="${href('day', x.k)}" aria-label="${aria}" data-day="${x.k}">${body}</a>`;
  };

  $('calBody').innerHTML = `
    <div class="wgrid" id="weekGrid">
      ${list.map(card).join('')}
      <div class="wsum">
        <div><span>Average</span><b>${fmtL(avg)} L</b></div>
        <div><span>At goal</span><b>${atGoal} of ${past.length}</b></div>
        <div><span>Extra</span><b class="x">+${fmtL(extra)} L</b></div>
      </div>
    </div>`;
  return { update: () => mountWeek(view, key), destroy() {} };
}

// =========================================================
// Day — the day's bottles, 24-hour line and every drink
// =========================================================
function mountDay(view, key) {
  const date = keyToDate(key);
  const { goal, bonus } = goalFor(key);
  const list = drinksOn(key);
  const total = list.reduce((s, d) => s + d.ml, 0);
  const ex = Math.max(0, total - goal);
  const isToday = key === todayKey();
  const next = dayKey(addDays(date, 1));

  let run = 0, reachedAt = null;
  const rows = list.map((d) => {
    const before = run; run += d.ml;
    if (reachedAt == null && run >= goal) reachedAt = d.ts;
    return { d, extra: before >= goal };
  });

  view.innerHTML = shell('day', key, {
    label: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    right: `${list.length} drink${list.length === 1 ? '' : 's'}`,
    prevKey: dayKey(addDays(date, -1)), nextKey: next <= todayKey() ? next : null
  });

  const pct = Math.min(100, total / goal * 100);
  const exPct = Math.min(ex, bonus) / bonus * 100;
  $('calBody').innerHTML = `
    <section class="stage day-stage" aria-label="Water on this day">
      <div class="timeline" role="img" aria-label="Drinks along a 24-hour line">${timelineHTML(list, { now: isToday, key })}</div>
      <div class="bottle-wrap big ${total >= goal ? 'full' : ''}">
        <div class="cap"></div><div class="neck"></div>
        <div class="body"><div class="fill day-fill" style="height:${pct.toFixed(1)}%">${WAVE('var(--water)')}<div class="shine"></div></div></div>
      </div>
      <div class="bonus-col ${total >= goal ? 'open' : 'locked'}">
        <div class="bottle-wrap bonus">
          <div class="cap"></div><div class="neck"></div>
          <div class="body"><div class="fill day-fill" style="height:${exPct.toFixed(1)}%;animation-delay:900ms"></div></div>
        </div>
        <div class="bonus-text"><b>Bonus</b><span>${total >= goal ? `${Math.min(ex, bonus)} / ${bonus} ml` : '—'}</span></div>
      </div>
    </section>
    <section class="amount">
      <div class="row"><span class="big-num" id="dayTotal">${fmtL(total)}</span><span class="of">/ ${fmtMl(goal)}</span></div>
      <span class="sub" id="daySub">${reachedAt != null ? `Goal reached at ${hhmm(reachedAt)}${ex ? ` · <span class="x">+${ex} ml extra</span>` : ''}`
        : list.length ? `${goal - total} ml short of the goal` : 'Nothing logged this day'}</span>
    </section>
    <ul class="entries day-list" id="dayList">
      ${rows.slice().reverse().map(({ d, extra }) => `
        <li class="entry">
          <div class="ico ${extra ? 'bonus' : ''}">${icons.cup(20, extra ? 'var(--bonus-text)' : 'var(--water-light)')}</div>
          <div class="what"><b>${fmtMl(d.ml)}</b><span>${extra ? 'Extra · bonus bottle' : 'Main bottle'}</span></div>
          <time>${hhmm(d.ts)}</time>
        </li>`).join('')}
    </ul>
    <a class="log-link" id="editDay" href="#/water/log${isToday ? '' : '/' + key}"><b>Change this day's drinks</b><span>Add, edit or delete ›</span></a>`;
  return { update: () => mountDay(view, key), destroy() {} };
}

// =========================================================
// Entry point from the router, plus pinch to zoom
// =========================================================
export function mountCalendar(view, params = []) {
  let [kind, key] = params;
  if (!VIEWS.includes(kind)) kind = 'month';
  if (!isKey(key) || isFuture(key)) key = todayKey();
  const page = kind === 'day' ? mountDay(view, key) : kind === 'week' ? mountWeek(view, key) : mountMonth(view, key);
  const stopPinch = enablePinch(view, kind, key);
  return { update: page.update, destroy: () => { stopPinch(); page.destroy(); } };
}

// Two fingers apart = zoom in (month → week → day); together = zoom out.
// On a laptop, a trackpad pinch (ctrl + wheel) does the same.
function enablePinch(el, kind, key) {
  let startDist = null, done = false;
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const zoom = (dir) => {
    const i = VIEWS.indexOf(kind) + dir;              // -1 = more detail
    if (i < 0 || i >= VIEWS.length || done) return;
    done = true;
    location.hash = href(VIEWS[i], key).slice(1);
  };
  const onStart = (e) => { if (e.touches.length === 2) { startDist = dist(e.touches); done = false; } };
  const onMove = (e) => {
    if (startDist == null || e.touches.length !== 2) return;
    if (e.cancelable) e.preventDefault();
    const r = dist(e.touches) / startDist;
    if (r > 1.25) zoom(-1); else if (r < 0.8) zoom(1);
  };
  const onEnd = () => { startDist = null; };
  let wheelSum = 0, wheelTimer = null;
  const onWheel = (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    wheelSum += e.deltaY;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelSum = 0; }, 250);
    if (wheelSum < -40) zoom(-1); else if (wheelSum > 40) zoom(1);
  };
  el.style.touchAction = 'pan-x pan-y';            // the page itself doesn't zoom; we do
  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: false });
  el.addEventListener('touchend', onEnd);
  el.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    el.style.touchAction = '';
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove', onMove);
    el.removeEventListener('touchend', onEnd);
    el.removeEventListener('wheel', onWheel);
    clearTimeout(wheelTimer);
  };
}

