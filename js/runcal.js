// =========================================================
// Running calendar (Update 5): Month, Week and Day for runs.
// Addresses: #/calendar/run/month|week|day/2026-11-17
// Squares fill orange with the day's distance (full at goal ÷ 2.5,
// e.g. 6 km for a 15 km week); treadmill runs get a slope mark;
// the Month view has an extra column with each week's goal ring.
// =========================================================
import { state, runGoalFor, runsOn, runsInWeek, climbedM } from './state.js';
import { $, icons, hhmm, dayKey } from './ui.js';
import { shell, href, keyToDate, isKey, addDays, mondayOf, todayKey, isFuture, enablePinch } from './calendar.js';
import { fmtKm, fmtDur, runLine, openRunSheet } from './running.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LEGEND = `<span><i style="background:var(--run)"></i>Distance</span>
  <span><i class="slope-i">${icons.slope}</i>Treadmill</span>`;

function kmByDay() {
  const out = {};
  state.runs.forEach((r) => {
    const k = dayKey(r.ts);
    out[k] = out[k] || { km: 0, tm: false, n: 0 };
    out[k].km += r.km; out[k].n++;
    if (r.where === 'treadmill') out[k].tm = true;
  });
  return out;
}

// ---------- month ----------
function mountMonth(view, key) {
  const focus = keyToDate(key);
  const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
  const days = new Date(focus.getFullYear(), focus.getMonth() + 1, 0).getDate();
  const byDay = kmByDay();
  const today = todayKey();
  let monthKm = 0, monthRuns = 0;
  for (let d = 1; d <= days; d++) { const k = dayKey(new Date(first.getFullYear(), first.getMonth(), d)); if (byDay[k]) { monthKm += byDay[k].km; monthRuns += byDay[k].n; } }

  const prev = dayKey(new Date(first.getFullYear(), first.getMonth() - 1, 1));
  const nf = new Date(first.getFullYear(), first.getMonth() + 1, 1);
  view.innerHTML = shell('month', key, {
    habit: 'run', legend: LEGEND + '<span><i class="ring-i"></i>Week</span>',
    label: first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    right: `${fmtKm(monthKm)} km · ${monthRuns} run${monthRuns === 1 ? '' : 's'}`,
    prevKey: prev, nextKey: dayKey(nf) <= today ? dayKey(nf) : null
  });

  const start = mondayOf(first);
  const rows = Math.ceil(((first.getDay() + 6) % 7 + days) / 7);
  let cells = '';
  for (let w = 0; w < rows; w++) {
    const mon = addDays(start, w * 7);
    const { goal, bonus } = runGoalFor(dayKey(mon));
    const fullDay = goal / 2.5;
    let weekKm = 0;
    for (let i = 0; i < 7; i++) {
      const date = addDays(mon, i), k = dayKey(date);
      const info = byDay[k] || { km: 0, tm: false };
      weekKm += info.km;
      const other = date.getMonth() !== first.getMonth(), future = isFuture(k);
      const pct = Math.min(100, info.km / fullDay * 100);
      const cls = ['mcell', 'rcell', other && 'other', future && 'future', k === today && 'today', pct >= 70 && 'deep'].filter(Boolean).join(' ');
      const delay = (w * 7 + i) * 30;
      const inner = `${info.km ? `<div class="rfill" style="height:${pct.toFixed(1)}%;animation-delay:${delay}ms"></div><span class="rkm">${fmtKm(info.km).replace(/\.0$/, '')}</span>` : ''}
        ${info.tm ? `<span class="rslope">${icons.slope}</span>` : ''}<span class="mnum">${date.getDate()}</span>`;
      const aria = `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, ${future ? 'not yet' : info.km ? fmtKm(info.km) + ' km' : 'no run'}`;
      cells += future ? `<span class="${cls}" aria-label="${aria}" data-day="${k}">${inner}</span>`
        : `<a class="${cls}" href="${href('day', k, 'run')}" aria-label="${aria}" data-day="${k}">${inner}</a>`;
    }
    const f = Math.min(1, weekKm / goal), ex = Math.max(0, weekKm - goal);
    cells += `<a class="wring" href="${href('week', dayKey(mon), 'run')}" aria-label="Week of ${mon.getDate()} ${mon.toLocaleDateString('en-GB', { month: 'short' })}: ${fmtKm(weekKm)} of ${goal} km" data-week="${dayKey(mon)}">
      <svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="14" class="ring-bg"/><circle cx="18" cy="18" r="14" class="ring" pathLength="100" style="stroke-dasharray:${(f * 100).toFixed(1)} 100"/>
      ${ex ? `<circle cx="18" cy="18" r="9" class="ring bonus" pathLength="100" style="stroke-dasharray:${(Math.min(ex, bonus) / bonus * 100).toFixed(1)} 100"/>` : ''}</svg>
      <span>${weekKm ? fmtKm(weekKm).replace(/\.0$/, '') : '–'}</span></a>`;
  }
  $('calBody').innerHTML = `
    <div class="mgrid rgrid weekdays">${WEEKDAYS.map((w) => `<span>${w.toUpperCase()}</span>`).join('')}<span>WEEK</span></div>
    <div class="mgrid rgrid" id="monthGrid">${cells}</div>`;
  return { update: () => mountMonth(view, key) };
}

// ---------- week ----------
function mountWeek(view, key) {
  const mon = mondayOf(keyToDate(key));
  const wk = dayKey(mon);
  const { goal, bonus } = runGoalFor(wk);
  const runs = runsInWeek(wk);
  const today = todayKey();
  const total = runs.reduce((s, r) => s + r.km, 0);
  const time = runs.reduce((s, r) => s + r.sec, 0);
  const climbed = runs.reduce((s, r) => s + climbedM(r), 0);
  const sun = addDays(mon, 6);
  const f = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const nm = addDays(mon, 7);
  view.innerHTML = shell('week', key, {
    habit: 'run', legend: LEGEND,
    label: mon.getMonth() === sun.getMonth() ? `${mon.getDate()} – ${f(sun)}` : `${f(mon)} – ${f(sun)}`,
    right: `${fmtKm(total)} / ${goal} km`,
    prevKey: dayKey(addDays(mon, -7)), nextKey: dayKey(nm) <= today ? dayKey(nm) : null
  });
  const fullDay = goal / 2.5;
  const cards = WEEKDAYS.map((wd, i) => {
    const d = addDays(mon, i), k = dayKey(d);
    const dayRuns = runs.filter((r) => dayKey(r.ts) === k);
    const km = dayRuns.reduce((s, r) => s + r.km, 0);
    const tm = dayRuns.find((r) => r.where === 'treadmill');
    const future = isFuture(k);
    const body = `<span class="wday">${wd} ${d.getDate()}</span>
      <div class="rbar">${km ? `<div class="rbar-fill" style="height:${Math.min(100, km / fullDay * 100).toFixed(1)}%;animation-delay:${i * 120}ms"></div>` : ''}</div>
      <span class="wamt">${km ? fmtKm(km) + ' km' : future ? '—' : 'Rest'}</span>
      <span class="wsub">${tm ? `${icons.slope} ${tm.incline}%` : dayRuns.length ? 'Outdoor' : '&nbsp;'}</span>`;
    const cls = ['wcard', 'rcard', k === today && 'today', future && 'future'].filter(Boolean).join(' ');
    return future ? `<div class="${cls}" data-day="${k}">${body}</div>` : `<a class="${cls}" href="${href('day', k, 'run')}" data-day="${k}" aria-label="${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, ${km ? fmtKm(km) + ' km' : 'no run'}">${body}</a>`;
  }).join('');
  const pct = Math.min(total, goal) / goal * 100, ex = Math.max(0, total - goal);
  $('calBody').innerHTML = `
    <div class="wgrid" id="weekGrid">${cards}
      <div class="wsum rsum">
        <div><span>Goal</span><b>${Math.round(pct)}%</b></div>
        <div><span>Time</span><b>${fmtDur(time)}</b></div>
        <div><span>${ex ? 'Bonus' : 'Climbed'}</span><b class="x-run">${ex ? '+' + fmtKm(ex) + ' km' : climbed + ' m'}</b></div>
      </div>
    </div>`;
  return { update: () => mountWeek(view, key) };
}

// ---------- day ----------
function mountDay(view, key) {
  const date = keyToDate(key);
  const runs = runsOn(key);
  const total = runs.reduce((s, r) => s + r.km, 0);
  const next = dayKey(addDays(date, 1).getTime());
  view.innerHTML = shell('day', key, {
    habit: 'run', legend: LEGEND,
    label: date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    right: runs.length ? `${fmtKm(total)} km` : '',
    prevKey: dayKey(addDays(date, -1)), nextKey: next <= todayKey() ? next : null
  });
  $('calBody').innerHTML = `
    <ul class="entries run-list" id="runList">
      ${runs.length ? runs.slice().reverse().map((r) => `
        <li class="entry tappable" data-run="${r.id}">
          <div class="ico run">${r.where === 'treadmill' ? icons.treadmill : icons.run}</div>
          <button class="what" aria-label="Change the ${fmtKm(r.km)} km run at ${hhmm(r.ts)}"><b>${fmtKm(r.km)} km <small>· ${fmtDur(r.sec)}</small></b><span>${runLine(r)}${climbedM(r) ? ` · ${climbedM(r)} m climbed` : ''}</span></button>
          <time>${hhmm(r.ts)}</time>
        </li>`).join('') : `<li class="empty">Rest day — no runs.</li>`}
    </ul>
    <button class="custom-btn add-past" id="addRunDay">${icons.plus} Add a run to this day</button>`;
  $('runList').onclick = (ev) => {
    const li = ev.target.closest('[data-run]');
    if (li) openRunSheet(state.runs.find((r) => r.id === li.dataset.run));
  };
  $('addRunDay').onclick = () => {
    const d = keyToDate(key); const now = new Date();
    d.setHours(key === todayKey() ? now.getHours() : 8, key === todayKey() ? now.getMinutes() : 0);
    openRunSheet(null, { ts: d.getTime() });
  };
  return { update: () => mountDay(view, key) };
}

export function mountRunCalendar(view, params = []) {
  let [kind, key] = params;
  if (!['day', 'week', 'month'].includes(kind)) kind = 'month';
  if (!isKey(key) || isFuture(key)) key = todayKey();
  const page = kind === 'day' ? mountDay(view, key) : kind === 'week' ? mountWeek(view, key) : mountMonth(view, key);
  const stop = enablePinch(view, kind, key, 'run');
  return { update: page.update, destroy: stop };
}

