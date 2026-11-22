// =========================================================
// Running (Update 5): this week's track, logging and editing runs.
// The weekly goal is a running track that fills lap by lap, like the
// water bottle. Past the goal, a lighter inner bonus lap fills.
// =========================================================
import {
  state, addRun, updateRun, deleteRun, undoAddRun, restoreItem,
  runGoalFor, runsInWeek, mondayKey, paceSec, speedKmh, climbedM
} from './state.js';
import { $, esc, icons, pad, hhmm, dayKey, openSheet, closeSheet, showToast, showBanner } from './ui.js';
import { openSettings } from './settings.js';

const WEEKDAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ---------- formatting ----------
export const fmtKm = (km) => (Math.round(km * 10) / 10).toFixed(1);
export const fmtDur = (sec) => {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};
export const fmtPace = (sec) => (sec > 0 ? `${Math.floor(sec / 60)}:${pad(Math.round(sec % 60) % 60)}` : '–');
// "28:40", "1:05:00", "45" (minutes) → seconds
export function parseDur(str) {
  const parts = String(str).trim().split(':').map((x) => x.trim());
  if (!parts.length || parts.some((x) => x === '' || !/^\d+(\.\d+)?$/.test(x))) return NaN;
  const n = parts.map(Number);
  if (n.length === 1) return n[0] * 60;
  if (n.length === 2) return n[0] * 60 + n[1];
  if (n.length === 3) return n[0] * 3600 + n[1] * 60 + n[2];
  return NaN;
}
const weekLabel = (mon) => {
  const a = new Date(mon), b = new Date(mon); b.setDate(b.getDate() + 6);
  const f = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${f(b)}` : `${f(a)} – ${f(b)}`;
};
const keyDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
export function runLine(r) {
  const where = r.where === 'treadmill' ? `Treadmill · ${r.incline || 0}% incline` : 'Outdoor';
  return `${where} · ${fmtPace(paceSec(r))} /km`;
}

// ---------- the track ----------
// A stadium shape, drawn clockwise from the start line on the top straight.
const TW = 300, TH = 180;
const stadium = (inset) => {
  const r = TH / 2 - inset, x0 = TH / 2, x1 = TW - TH / 2, top = inset, bot = TH - inset;
  return `M ${x0},${top} H ${x1} A ${r} ${r} 0 0 1 ${x1},${bot} H ${x0} A ${r} ${r} 0 0 1 ${x0},${top} Z`;
};
const LANE = stadium(12), BONUS_LANE = stadium(34);

let lastAddedId = null;     // animate the newest run along the track
let shownFrac = null;       // where the track was drawn last time (for the animation)

export function mountRunning(view) {
  view.innerHTML = `
    <header class="head">
      <div><div class="date" id="runWeek"></div><h1>Running</h1></div>
      <div class="head-right"><button class="icon-btn" id="runSettings" aria-label="Settings">${icons.sliders}</button></div>
    </header>
    <section class="track-wrap" aria-label="This week's running">
      <div class="track" id="track">
        <svg viewBox="0 0 ${TW} ${TH}" role="img" id="trackSvg" aria-label="">
          <path d="${LANE}" class="lane"/>
          <path d="${LANE}" class="lane-marks"/>
          <path d="${BONUS_LANE}" class="lane bonus-lane"/>
          <path d="${BONUS_LANE}" class="lane-marks"/>
          <line x1="90" y1="1" x2="90" y2="23" class="start-line"/>
          <path d="${LANE}" pathLength="100" class="progress" id="trackMain"/>
          <path d="${BONUS_LANE}" pathLength="100" class="progress bonus" id="trackBonus"/>
          <g id="notches"></g>
          <circle r="8" class="runner" id="runner"/>
        </svg>
        <div class="track-center">
          <div class="row"><span class="big-num" id="runTotal">0.0</span><span class="of" id="runGoalOf"></span></div>
          <span class="sub" id="runSub"></span>
        </div>
      </div>
      <div class="track-legend">
        <span><i class="sw-main"></i>Weekly goal</span><span><i class="sw-bonus"></i>Bonus lap</span><span><i class="sw-run"></i>Each run</span>
      </div>
    </section>
    <div class="week-strip" id="weekStrip"></div>
    <section class="run-actions">
      <button class="btn run-primary" id="logRun">${icons.plus} Log a run</button>
      <button class="custom-btn run-again hidden" id="runAgain"></button>
    </section>
    <a class="log-link" id="lastRun" href="#/calendar/run/week"><b>This week's runs</b><span id="runCount"></span></a>`;

  $('runSettings').onclick = openSettings;
  $('logRun').onclick = () => openRunSheet();
  $('runAgain').onclick = () => {
    const last = state.runs[state.runs.length - 1];
    if (last) openRunSheet(null, { km: last.km, sec: last.sec, where: last.where, incline: last.incline });
  };
  shownFrac = null;
  update();
  return { update, destroy() {} };
}

function update() {
  if (!$('track')) return;
  const week = mondayKey();
  const { goal, bonus } = runGoalFor(week);
  const runs = runsInWeek(week);
  const total = runs.reduce((s, r) => s + r.km, 0);
  const extra = Math.max(0, total - goal);
  const mainPct = Math.min(total, goal) / goal * 100;
  const bonusPct = Math.min(extra, bonus) / bonus * 100;

  $('runWeek').textContent = 'This week · ' + weekLabel(keyDate(week));
  $('runTotal').textContent = fmtKm(total);
  $('runGoalOf').textContent = `/ ${+goal.toFixed(1)} km`;
  $('runSub').innerHTML = total >= goal
    ? `<span class="x-run">+${fmtKm(extra)} km bonus</span> · ${runs.length} run${runs.length === 1 ? '' : 's'}`
    : runs.length ? `${fmtKm(goal - total)} km to go · ${runs.length} run${runs.length === 1 ? '' : 's'}` : 'No runs yet this week';
  $('trackSvg').setAttribute('aria-label', `This week: ${fmtKm(total)} of ${goal} kilometres`);
  $('track').classList.toggle('reached', total >= goal);

  // draw the lanes, animating from where they were
  const main = $('trackMain'), bon = $('trackBonus');
  const from = shownFrac || { main: 0, bonus: 0 };
  animateDash(main, from.main, mainPct, 0);
  animateDash(bon, from.bonus, bonusPct, from.main < 100 && mainPct >= 100 ? 1100 : 0);
  shownFrac = { main: mainPct, bonus: bonusPct };

  // a small marker where each run ended (on the goal lane)
  let run = 0;
  const lane = main.getTotalLength ? main : null;
  const marks = [];
  runs.slice(0, -1).forEach((r) => {
    run += r.km;
    if (run < goal && lane) {
      const p = lane.getPointAtLength(lane.getTotalLength() * run / goal);
      marks.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" class="notch"/>`);
    }
  });
  $('notches').innerHTML = marks.join('');
  moveRunner(from, { main: mainPct, bonus: bonusPct }, from.main < 100 && mainPct >= 100);

  // week strip: one small pill per day
  const mon = keyDate(week);
  const today = dayKey(Date.now());
  const fullDay = goal / 2.5;
  $('weekStrip').innerHTML = WEEKDAY.map((wd, i) => {
    const d = new Date(mon); d.setDate(d.getDate() + i);
    const k = dayKey(d.getTime());
    const dayRuns = runs.filter((r) => dayKey(r.ts) === k);
    const km = dayRuns.reduce((s, r) => s + r.km, 0);
    const tm = dayRuns.some((r) => r.where === 'treadmill');
    const future = k > today;
    const inner = `<div class="pill ${k === today ? 'today' : ''}">${km ? `<div class="pill-fill" style="height:${Math.min(100, km / fullDay * 100).toFixed(0)}%;animation-delay:${200 + i * 80}ms"></div>` : ''}${tm ? `<span class="pill-slope">${icons.slope}</span>` : ''}</div>
      <span class="wd ${k === today ? 'today' : ''}">${wd}</span><span class="km">${km ? fmtKm(km) : '–'}</span>`;
    return future ? `<div class="day future" aria-label="${d.toLocaleDateString('en-GB', { weekday: 'long' })}, not yet">${inner}</div>`
      : `<a class="day" href="#/calendar/run/day/${k}" aria-label="${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${km ? fmtKm(km) + ' km' : 'no run'}">${inner}</a>`;
  }).join('');

  const last = state.runs[state.runs.length - 1];
  const again = $('runAgain');
  again.classList.toggle('hidden', !last);
  if (last) again.textContent = `Same as last: ${fmtKm(last.km)} km · ${last.where === 'treadmill' ? `treadmill ${last.incline || 0}%` : 'outdoor'}`;
  $('runCount').textContent = runs.length ? `${runs.length} run${runs.length === 1 ? '' : 's'} · ${fmtDur(runs.reduce((s, r) => s + r.sec, 0))} ›` : 'None yet ›';
  lastAddedId = null;
}

function animateDash(path, from, to, delay) {
  path.style.strokeDasharray = `${to.toFixed(2)} 100`;
  if (Math.abs(from - to) < 0.01 || !path.animate) return;
  path.animate([{ strokeDasharray: `${from.toFixed(2)} 100` }, { strokeDasharray: `${to.toFixed(2)} 100` }],
    { duration: 1100, delay, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
}

// The white runner dot runs along the lane to the new total
function moveRunner(from, to, crossed) {
  const dot = $('runner');
  const main = $('trackMain'), bon = $('trackBonus');
  if (!dot || !main.getTotalLength) return;
  const place = (lane, pct) => {
    const p = lane.getPointAtLength(lane.getTotalLength() * Math.min(pct, 99.9) / 100);
    dot.setAttribute('cx', p.x.toFixed(1)); dot.setAttribute('cy', p.y.toFixed(1));
  };
  const onBonus = to.bonus > 0;
  dot.classList.toggle('hidden', to.main === 0);
  if (to.main === 0) return;
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 1100);
    const e = 1 - Math.pow(1 - k, 3);
    if (crossed && onBonus) {
      // first finish the goal lane, then hop to the bonus lane
      if (k < 0.5) place(main, from.main + (100 - from.main) * (e / 0.875));
      else place(bon, to.bonus * Math.min(1, (e - 0.5) / 0.5));
    } else if (onBonus) place(bon, from.bonus + (to.bonus - from.bonus) * e);
    else place(main, from.main + (to.main - from.main) * e);
    if (k < 1 && document.body.contains(dot)) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// =========================================================
// Log a run / change a run
// =========================================================
export function openRunSheet(run = null, preset = null) {
  const now = new Date();
  const base = run || { km: 5, sec: 0, where: 'outdoor', incline: 0, ...(preset || {}) };
  const date = run ? new Date(run.ts) : (preset && preset.ts ? new Date(preset.ts) : now);
  const dateVal = dayKey(date.getTime());
  const timeVal = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const kmChips = [3, 5, 8, 10, 21.1];
  const incChips = [0, 1, 2, 4, 6];
  let where = base.where;
  let incline = base.incline || 0;

  openSheet(`
    <div class="sheet-head"><h2>${run ? 'Change run' : 'Log a run'}</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
    <div class="seg" role="tablist" aria-label="Where">
      <button role="tab" data-where="outdoor">${icons.run}Outdoor</button>
      <button role="tab" data-where="treadmill">${icons.treadmill}Treadmill</button>
    </div>
    <div class="run-fields">
      <div class="run-field"><label for="kmIn">Distance</label><div><input id="kmIn" inputmode="decimal" value="${fmtKm(base.km)}" autocomplete="off"><span>km</span></div></div>
      <div class="run-field"><label for="durIn">Time</label><div><input id="durIn" inputmode="numeric" placeholder="28:40" value="${base.sec ? fmtDur(base.sec) : ''}" autocomplete="off"><span>min</span></div></div>
    </div>
    <div class="pills" id="kmChips">${kmChips.map((k) => `<button class="pill-btn" data-km="${k}">${k} km</button>`).join('')}</div>
    <div class="incline-box" id="inclineBox">
      <div class="incline-head">
        <label for="incIn">Incline</label>
        <div class="incline-show"><svg aria-hidden="true" width="64" height="26" viewBox="0 0 64 26"><path d="M2 24 H62" class="ramp-base"/><path id="ramp" d="M2 24 L62 24" class="ramp"/></svg>
          <input id="incIn" inputmode="decimal" value="${incline}" aria-label="Incline in percent"><span>%</span></div>
      </div>
      <div class="pills" id="incChips">${incChips.map((v) => `<button class="pill-btn" data-inc="${v}">${v}%</button>`).join('')}</div>
    </div>
    <div class="run-stats">
      <div><span>Pace</span><b id="paceOut">–</b></div>
      <div><span>Speed</span><b id="speedOut">–</b></div>
      <div><span>Climbed</span><b id="climbOut" class="x-run">–</b></div>
    </div>
    <div class="when-row">
      <label for="runDate">When</label>
      <input id="runDate" type="date" value="${dateVal}" max="${dayKey(Date.now())}">
      <input id="runTime" type="time" value="${timeVal}" aria-label="Start time">
    </div>
    <button class="btn run-primary" id="saveRun">${run ? 'Save' : 'Save run'}</button>
    ${run ? '<button class="btn danger" id="delRun">Delete this run</button>' : ''}`, {
    label: run ? 'Change run' : 'Log a run',
    onMount: (sheet) => {
      const kmIn = $('kmIn'), durIn = $('durIn'), incIn = $('incIn');
      const readKm = () => Number(String(kmIn.value).replace(',', '.'));
      const readInc = () => Math.max(0, Math.min(15, Number(String(incIn.value).replace(',', '.')) || 0));
      const sync = () => {
        sheet.querySelectorAll('[data-where]').forEach((b) => {
          const on = b.dataset.where === where; b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
        });
        $('inclineBox').classList.toggle('hidden', where !== 'treadmill');
        incline = readInc();
        sheet.querySelectorAll('[data-inc]').forEach((b) => b.classList.toggle('on', Number(b.dataset.inc) === incline));
        sheet.querySelectorAll('[data-km]').forEach((b) => b.classList.toggle('on', Number(b.dataset.km) === readKm()));
        $('ramp').setAttribute('d', `M2 24 L62 ${(24 - Math.min(incline, 15) * 1.3).toFixed(1)}`);
        const r = { km: readKm(), sec: parseDur(durIn.value), where, incline };
        const ok = r.km > 0 && r.sec > 0;
        $('paceOut').textContent = ok ? `${fmtPace(paceSec(r))} /km` : '–';
        $('speedOut').textContent = ok ? `${speedKmh(r).toFixed(1)} km/h` : '–';
        $('climbOut').textContent = where === 'treadmill' && r.km > 0 ? `≈ ${climbedM(r)} m` : '–';
      };
      sheet.querySelectorAll('[data-where]').forEach((b) => { b.onclick = () => { where = b.dataset.where; sync(); }; });
      sheet.querySelectorAll('[data-km]').forEach((b) => { b.onclick = () => { kmIn.value = b.dataset.km; sync(); }; });
      sheet.querySelectorAll('[data-inc]').forEach((b) => { b.onclick = () => { incIn.value = b.dataset.inc; sync(); }; });
      [kmIn, durIn, incIn].forEach((el) => { el.oninput = sync; });
      sync();
      if (!run) (base.sec ? $('saveRun') : durIn).focus();

      $('saveRun').onclick = async () => {
        const km = readKm(), sec = parseDur(durIn.value);
        if (!(km > 0 && km <= 300)) { showToast('Enter the distance in km'); kmIn.focus(); return; }
        if (!(sec > 0 && sec < 48 * 3600)) { showToast('Enter the time, like 28:40'); durIn.focus(); return; }
        const [y, m, d] = $('runDate').value.split('-').map(Number);
        const [hh, mm] = ($('runTime').value || timeVal).split(':').map(Number);
        const ts = new Date(y, m - 1, d, hh, mm).getTime();
        if (!(ts > 0)) { showToast('Pick a date'); return; }
        if (ts > Date.now()) { showToast("That time hasn't happened yet"); return; }
        const data = { km, sec, where, incline: where === 'treadmill' ? readInc() : 0, ts };
        closeSheet();
        if (run) {
          const before = await updateRun(run.id, data);
          showToast(`Saved ${fmtKm(km)} km`, { undo: () => updateRun(run.id, before) });
        } else {
          const week = mondayKey(ts);
          const { goal } = runGoalFor(week);
          const beforeTotal = runsInWeek(week).reduce((s, r) => s + r.km, 0);
          const saved = await addRun(data);
          lastAddedId = saved.id;
          showToast(`Run saved · ${fmtKm(km)} km`, { undo: () => undoAddRun(saved.id) });
          if (week === mondayKey() && beforeTotal < goal && beforeTotal + km >= goal) {
            setTimeout(() => showBanner('Weekly goal reached!', 'The bonus lap is open.'), 900);
          }
        }
      };
      if (run) $('delRun').onclick = async () => {
        closeSheet();
        const r = await deleteRun(run.id);
        if (r) showToast(`Deleted the ${fmtKm(r.km)} km run`, { undo: () => restoreItem(r.id) });
      };
    }
  });
}

