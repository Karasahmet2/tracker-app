// =========================================================
// Water: the Today page (bottles, 24-hour line, cups) and
// the Today's log page.
// =========================================================
import { state, addDrink, deleteDrink, undoAdd, restoreDrink, updateDrink, setSetting, drinksOn, goalFor } from './state.js';
import {
  $, esc, icons, pad, hhmm, minutesOf, dayKey, fmtMl, fmtL, longDate,
  openSheet, closeSheet, showToast, showBanner, goBack
} from './ui.js';
import { openSettings, openBackup } from './settings.js';
import { backupDue } from './safety.js';

// The 24-hour line is as tall as the screen allows, so twigs are placed in % of it.
const pctOfDay = (ts) => (minutesOf(ts) / 1440 * 100).toFixed(2) + '%';
const POUR_MS = 1900;         // whole pour animation
const COMMIT_MS = 450;        // when the drink is saved during the pour

let busy = false;             // true while a pour is playing
let lastAddedId = null;       // the newest branch grows in once

const cupIconSize = (ml) => ml <= 200 ? 18 : ml <= 350 ? 22 : ml <= 600 ? 26 : 30;
const WAVE = (fill, top, h, cls = '') =>
  `<svg class="wave ${cls}" aria-hidden="true" viewBox="0 0 320 20" preserveAspectRatio="none" style="top:${top}px;height:${h}px"><path d="M0 10 Q20 2 40 10 T80 10 T120 10 T160 10 T200 10 T240 10 T280 10 T320 10 V20 H0Z" style="fill:${fill}"/></svg>`;

// =========================================================
// Today page
// =========================================================
export function mountToday(view) {
  view.innerHTML = `
    <header class="head">
      <div><div class="date" id="dateLabel"></div><h1>Water</h1></div>
      <div class="head-right">
        <button class="icon-btn backup-btn" id="backupBtn" aria-label="Back up your data">${icons.backup}<i class="due-dot hidden" id="backupDot"></i></button>
        <button class="icon-btn" id="settingsBtn" aria-label="Settings">${icons.sliders}</button>
      </div>
    </header>

    <section class="stage" aria-label="Today's progress">
      <div class="timeline" id="timeline" role="img" aria-label="Today's drinks along a 24-hour line"></div>

      <div class="bottle-wrap big" id="bigWrap">
        <div class="pour-layer" id="pourLayer" aria-hidden="true"></div>
        <div class="cap" id="bigCap"></div>
        <div class="neck"></div>
        <div class="body">
          <div class="fill" id="bigFill">${WAVE('var(--water)', -13, 14, 'back')}${WAVE('var(--water)', -10, 11)}<div class="shine"></div></div>
          <div class="tick" style="bottom:25%;width:16px"></div>
          <div class="tick" style="bottom:50%;width:24px"></div>
          <div class="tick" style="bottom:75%;width:16px"></div>
        </div>
      </div>

      <div class="bonus-col locked" id="bonusCol">
        <div class="bottle-wrap bonus">
          <div class="cap" id="bonusCap"></div>
          <div class="neck"></div>
          <div class="body"><div class="fill" id="bonusFill">${WAVE('var(--water)', -7, 8)}</div></div>
        </div>
        <div class="bonus-text"><b>Bonus</b><span id="bonusCaption"></span></div>
      </div>
    </section>

    <section class="amount" aria-live="polite">
      <div class="row"><span class="big-num" id="totalNum">0.00</span><span class="of" id="goalOf"></span></div>
      <span class="sub" id="remaining"></span>
    </section>

    <section class="cups">
      <div class="cup-grid" id="cupGrid"></div>
      <button class="custom-btn" id="customBtn">${icons.plus} Custom amount</button>
    </section>

    <a class="log-link" href="#/water/log" id="logLink"><b>Today's log</b><span id="logSummary"></span></a>`;

  $('settingsBtn').onclick = openSettings;
  $('backupBtn').onclick = openBackup;
  $('customBtn').onclick = openCustom;
  $('cupGrid').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ml]');
    if (b) requestAdd(Number(b.dataset.ml));
  });

  const timer = setInterval(() => { if (!busy) drawTimeline(); }, 30000);
  update();
  return { update, destroy: () => clearInterval(timer) };
}

function update() {
  if (!$('bigWrap')) return;
  const { cups } = state.settings;
  const { goal, bonus: bonusSize } = goalFor();
  const list = drinksOn();
  const total = list.reduce((s, d) => s + d.ml, 0);
  const reached = total >= goal;
  const bonus = Math.max(0, total - goal);

  $('dateLabel').textContent = longDate();
  const due = backupDue();
  $('backupDot').classList.toggle('hidden', !due);
  $('backupBtn').setAttribute('aria-label', due ? 'Back up your data (a backup is due)' : 'Back up your data');

  $('bigFill').style.height = (Math.min(total, goal) / goal * 100).toFixed(1) + '%';
  $('bigWrap').classList.toggle('full', reached);
  $('bonusFill').style.height = (Math.min(bonus, bonusSize) / bonusSize * 100).toFixed(1) + '%';
  $('bonusCol').classList.toggle('open', reached);
  $('bonusCol').classList.toggle('locked', !reached);
  $('bonusCaption').textContent = !reached ? `Unlocks at ${fmtMl(goal)}`
    : bonus > bonusSize ? `+${fmtMl(bonus)} extra` : `${bonus} / ${bonusSize} ml`;

  $('totalNum').textContent = fmtL(total);
  $('goalOf').textContent = '/ ' + fmtMl(goal);
  const pct = Math.round(total / goal * 100);
  $('remaining').textContent = reached ? `Goal reached · ${pct}%` : `${goal - total} ml to go · ${pct}%`;

  $('cupGrid').innerHTML = cups.map((ml) =>
    `<button class="cup" data-ml="${ml}" aria-label="Add ${fmtMl(ml)}" ${busy ? 'disabled' : ''}>${icons.cup(cupIconSize(ml))}<span>${fmtMl(ml)}</span></button>`).join('');
  $('customBtn').disabled = busy;

  $('logSummary').textContent = list.length
    ? `${list.length} drink${list.length > 1 ? 's' : ''} · last at ${hhmm(list[list.length - 1].ts)} ›`
    : 'No drinks yet ›';

  drawTimeline(list);
}

// ---------- 24-hour line ----------
// Shared with the calendar's Day page. `now` adds the moving "now" dot.
export function timelineHTML(list, { now = true, growId = null, key } = {}) {
  const goal = goalFor(key || (list[0] ? dayKey(list[0].ts) : undefined)).goal;
  let run = 0;
  const branches = list.map((d) => {
    const before = run; run += d.ml;
    const color = before >= goal ? 'var(--bonus)' : 'var(--water)';
    const w = Math.max(8, Math.round(Math.min(d.ml, 1500) / 1000 * 36));
    return `<div class="branch" data-branch="${d.id}" style="top:${pctOfDay(d.ts)}"><div class="twig ${d.id === growId ? 'grow' : ''}" style="width:${w}px;background:${color}"><div class="leaf"></div></div></div>`;
  }).join('');
  const hours = [0, 6, 12, 18, 24].map((h) =>
    `<div class="hour" style="top:${(h / 24 * 100).toFixed(2)}%"><span>${pad(h)}</span><span></span></div>`).join('');
  const nowTop = pctOfDay(Date.now());
  return `<div class="axis"></div>` +
    `<div class="past" style="height:${now ? nowTop : '100%'}"></div>` +
    hours + branches +
    (now ? `<div class="now-dot" style="top:${nowTop}"></div><span class="now-label" style="top:${nowTop}">now</span>` : '');
}

function drawTimeline(list = drinksOn()) {
  const el = $('timeline');
  if (!el) return;
  el.innerHTML = timelineHTML(list, { growId: lastAddedId });
  lastAddedId = null;
}

// =========================================================
// Adding water
// =========================================================
function requestAdd(ml) {
  if (busy) return;
  if (state.settings.ask) openConfirm(ml); else pourAndAdd(ml);
}

function pourAndAdd(ml) {
  if (busy) return;
  const goal = goalFor().goal;
  const before = drinksOn().reduce((s, d) => s + d.ml, 0);
  busy = true; update();
  playPour(before, ml);
  setTimeout(async () => {
    const d = await addDrink(ml);
    lastAddedId = d.id;
    update();
    showToast(`Added ${fmtMl(ml)}`, { undo: () => undoAdd(d.id) });
    if (before < goal && before + ml >= goal) showBanner('Goal reached!', 'Bonus bottle unlocked — keep going.');
  }, COMMIT_MS);
  setTimeout(() => { busy = false; update(); }, POUR_MS);
}

function openConfirm(ml) {
  const goal = goalFor().goal;
  const total = drinksOn().reduce((s, d) => s + d.ml, 0), after = total + ml;
  let note;
  if (total < goal && after >= goal) note = after > goal ? `This fills your bottle — ${after - goal} ml goes to the bonus bottle.` : 'This fills your bottle!';
  else if (total >= goal) note = `Goes into your bonus bottle · ${fmtL(after)} L today`;
  else note = `You'll be at ${fmtL(after)} of ${fmtMl(goal)}`;
  openSheet(`
    <div class="confirm-body">
      <div class="ico">${icons.cup(28)}</div>
      <div><h2>Add ${fmtMl(ml)}?</h2><p>${esc(note)}</p></div>
    </div>
    <div class="btn-row">
      <button class="btn" data-close>Cancel</button>
      <button class="btn primary" id="confirmYes">Yes, add it</button>
    </div>`, {
    label: 'Confirm drink',
    onMount: () => {
      $('confirmYes').focus();
      $('confirmYes').onclick = () => { closeSheet(); pourAndAdd(ml); };
    }
  });
}

function openCustom() {
  const s = state.settings;
  const start = s.recent[0] || 250;
  const pills = s.recent.slice(0, 4).map((ml) => `<button class="pill" data-pick="${ml}">${fmtMl(ml)}</button>`).join('');
  openSheet(`
    <div class="sheet-head"><h2>Custom amount</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
    <div class="stepper">
      <button id="minus" aria-label="Decrease by 50 ml">−50</button>
      <div class="mid">
        <label for="amt">Amount</label>
        <div class="val"><input id="amt" type="number" inputmode="numeric" min="10" max="3000" step="10" value="${start}"><span class="unit">ml</span></div>
      </div>
      <button id="plus" aria-label="Increase by 50 ml">+50</button>
    </div>
    ${pills ? `<div class="group"><span>Recent</span><div class="pills">${pills}</div></div>` : ''}
    <label class="check"><input type="checkbox" id="saveCup"><span><b>Save as a cup button</b><small id="saveNote"></small></span></label>
    <button class="btn primary" id="addCustom"></button>`, {
    label: 'Custom amount',
    onMount: (sheet) => {
      const amt = $('amt');
      const val = () => Math.max(10, Math.min(3000, Math.round(Number(amt.value) || 0)));
      const sync = () => {
        const v = val();
        $('addCustom').textContent = `Add ${fmtMl(v)}`;
        $('saveNote').textContent = `Adds ${fmtMl(v)} next to your other cups`;
      };
      $('minus').onclick = () => { amt.value = Math.max(10, val() - 50); sync(); };
      $('plus').onclick = () => { amt.value = Math.min(3000, val() + 50); sync(); };
      amt.oninput = sync;
      sheet.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => { amt.value = b.dataset.pick; sync(); }; });
      $('addCustom').onclick = async () => {
        const v = val();
        await setSetting('recent', [v, ...s.recent.filter((x) => x !== v)].slice(0, 6));
        if ($('saveCup').checked && !s.cups.includes(v)) await setSetting('cups', [...s.cups, v].sort((a, b) => a - b));
        closeSheet();
        pourAndAdd(v);
      };
      sync();
    }
  });
}

// ---------- pour animation ----------
function playPour(before, ml) {
  const layer = $('pourLayer');
  if (!layer) return;
  layer.innerHTML = '';
  const goal = goalFor().goal;
  const body = $('bigWrap').querySelector('.body');
  const surface = body.offsetTop + body.clientHeight * (1 - Math.min(before, goal) / goal);   // water line inside the big bottle
  const overflow = before + ml > goal;
  const anim = (el, frames, opts) => el.animate(frames, { duration: 1700, easing: 'ease-in-out', fill: 'forwards', ...opts });

  const cup = document.createElement('div');
  cup.className = 'pour-cup';
  cup.innerHTML = `<svg width="46" height="54" viewBox="0 0 46 54"><path d="M5 4h36l-4 44a3 3 0 0 1-3 2.6H12a3 3 0 0 1-3-2.6z" style="fill:var(--tint);stroke:var(--water-light)" stroke-width="3" stroke-linejoin="round"/><path d="M9.6 22h26.8l-2.4 26H12z" style="fill:var(--water)"/></svg>`;
  layer.appendChild(cup);
  anim(cup, [
    { transform: 'translateY(-24px) rotate(0)', opacity: 0, offset: 0 },
    { transform: 'translateY(0) rotate(0)', opacity: 1, offset: .15 },
    { transform: 'rotate(-118deg)', opacity: 1, offset: .35 },
    { transform: 'rotate(-118deg)', opacity: 1, offset: .72 },
    { transform: 'rotate(0)', opacity: 1, offset: .92 },
    { transform: 'rotate(0)', opacity: 0, offset: 1 }
  ]);

  const stream = document.createElement('div');
  stream.className = 'stream';
  stream.style.height = Math.max(60, surface + 28) + 'px';
  layer.appendChild(stream);
  anim(stream, [
    { transform: 'scaleY(0)', opacity: 1, offset: 0 },
    { transform: 'scaleY(0)', opacity: 1, offset: .3 },
    { transform: 'scaleY(1)', opacity: 1, offset: .46 },
    { transform: 'scaleY(1)', opacity: 1, offset: .7 },
    { transform: 'translateY(60px) scaleY(.4)', opacity: 0, offset: .84 },
    { transform: 'translateY(60px) scaleY(.4)', opacity: 0, offset: 1 }
  ]);

  if (before < goal) {
    const splash = document.createElement('div');
    splash.className = 'splash';
    splash.style.top = (surface - 10) + 'px';
    layer.appendChild(splash);
    anim(splash, [
      { transform: 'scale(.3)', opacity: 0, offset: 0 },
      { transform: 'scale(.3)', opacity: 0, offset: .42 },
      { transform: 'scale(.9)', opacity: .9, offset: .55 },
      { transform: 'scale(1.6)', opacity: 0, offset: .8 },
      { transform: 'scale(1.6)', opacity: 0, offset: 1 }
    ], { easing: 'ease-out' });
  }

  $('bigCap').style.transform = 'translate(-58px, 6px) rotate(-28deg)';
  if (overflow) {
    $('bonusCap').style.transform = 'translate(30px, 8px) rotate(30deg)';
    const wrap = $('bigWrap').getBoundingClientRect();
    const b = $('bonusCap').getBoundingClientRect();
    const sx = $('bigWrap').clientWidth / 2, sy = 26;
    const ex = b.left + b.width / 2 - wrap.left, ey = b.top - wrap.top + 6;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'arc-svg');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M${sx} ${sy} C ${sx + (ex - sx) * .25} ${sy - 60}, ${ex - (ex - sx) * .1} ${sy - 40}, ${ex} ${ey}`);
    path.setAttribute('fill', 'none');
    path.style.stroke = 'var(--water)';
    path.setAttribute('stroke-width', '7');
    path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path);
    layer.appendChild(svg);
    const L = path.getTotalLength ? path.getTotalLength() : 300;
    path.style.strokeDasharray = `60 ${L + 60}`;
    path.style.strokeDashoffset = '60';
    path.animate([{ strokeDashoffset: 60 }, { strokeDashoffset: -L }],
      { duration: 1100, delay: 750, easing: 'ease-in', fill: 'forwards' });
  }

  setTimeout(() => {
    if ($('bigCap')) $('bigCap').style.transform = '';
    if ($('bonusCap')) $('bonusCap').style.transform = '';
  }, 1650);
  setTimeout(() => { if ($('pourLayer')) $('pourLayer').innerHTML = ''; }, POUR_MS);
}

// =========================================================
// Log page — today's (#/water/log) or any past day's (#/water/log/2026-11-17).
// Tap a drink to change its amount or time; add drinks you forgot.
// =========================================================
const keyDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const tsFor = (key, hhmmStr) => { const [h, m] = hhmmStr.split(':').map(Number); const d = keyDate(key); d.setHours(h, m, 0, 0); return d.getTime(); };

export function mountLog(view, params = []) {
  const today = dayKey(Date.now());
  let key = params[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '') || key > today) key = today;
  const isToday = key === today;
  const title = isToday ? "Today's log" : 'Log · ' + keyDate(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  view.innerHTML = `
    <header class="log-head">
      <a class="icon-btn" href="${isToday ? '#/water' : '#/calendar/day/' + key}" id="logBack" aria-label="${isToday ? 'Back to today' : 'Back to the calendar'}">${icons.back}</a>
      <div><h1 id="logTitle">${esc(title)}</h1><span id="logDate"></span></div>
    </header>
    <div class="card">
      <div class="top"><div><b id="logTotal"></b><small id="logGoal"></small></div><span id="logCount"></span></div>
      <div>
        <div class="bars" id="bars" role="img" aria-label="Water by hour"></div>
        <div class="bars-x"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
      </div>
    </div>
    <button class="custom-btn add-past" id="addPast">${icons.plus} Add a drink${isToday ? '' : ' to this day'}</button>
    <ul class="entries" id="entries"></ul>
    <p class="foot-note">Tap a drink to change it. ${isToday ? 'The day resets at midnight. ' : 'Changes here only affect this day. '}Deleted drinks stay in Settings → Trash for 30 days.</p>`;

  $('logBack').onclick = (e) => { e.preventDefault(); goBack(isToday ? '/water' : '/calendar/day/' + key); };
  $('addPast').onclick = () => openAddDrinkSheet(key);
  $('entries').addEventListener('click', async (ev) => {
    const del = ev.target.closest('[data-del]');
    if (del) {
      const d = await deleteDrink(del.dataset.del);
      if (d) showToast(`Deleted ${fmtMl(d.ml)} · ${hhmm(d.ts)}`, { undo: () => restoreDrink(d.id) });
      return;
    }
    const row = ev.target.closest('[data-entry]');
    if (row) openDrinkSheet(key, state.drinks.find((x) => x.id === row.dataset.entry));
  });
  const update = () => updateLog(key);
  update();
  return { update, destroy() {} };
}

function updateLog(key) {
  if (!$('entries')) return;
  const { goal } = goalFor(key);
  const list = drinksOn(key);
  const total = list.reduce((s, d) => s + d.ml, 0);
  $('logDate').textContent = longDate(keyDate(key));
  $('logTotal').textContent = fmtL(total) + ' L';
  $('logGoal').textContent = 'of ' + fmtMl(goal);
  $('logCount').textContent = `${list.length} drink${list.length === 1 ? '' : 's'}`;

  const perHour = new Array(24).fill(0);
  list.forEach((d) => { perHour[new Date(d.ts).getHours()] += d.ml; });
  const max = Math.max(500, ...perHour);
  $('bars').innerHTML = perHour.map((ml) =>
    `<div class="${ml ? 'on' : ''}" style="height:${ml ? Math.max(6, ml / max * 82) : 4}px"></div>`).join('');

  let run = 0;
  const rows = list.map((d) => { const before = run; run += d.ml; return { d, isBonus: before >= goal }; }).reverse();
  $('entries').innerHTML = rows.length ? rows.map(({ d, isBonus }) => `
    <li class="entry tappable" data-entry="${d.id}">
      <div class="ico ${isBonus ? 'bonus' : ''}">${icons.cup(20, isBonus ? 'var(--bonus-text)' : 'var(--water-light)')}</div>
      <button class="what" data-edit="${d.id}" aria-label="Change ${fmtMl(d.ml)} at ${hhmm(d.ts)}"><b>${fmtMl(d.ml)}</b><span>${isBonus ? 'Extra · bonus bottle' : 'Main bottle'}</span></button>
      <time>${hhmm(d.ts)}</time>
      <button data-del="${d.id}" aria-label="Delete ${fmtMl(d.ml)} at ${hhmm(d.ts)}">${icons.trash}</button>
    </li>`).join('') : `<li class="empty">Nothing logged on this day.</li>`;
}

// Add a drink to a day, or change one (amount and time)
function openDrinkSheet(key, drink = null) {
  const today = dayKey(Date.now());
  const now = new Date();
  const defTime = key === today ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : '12:00';
  const start = drink ? drink.ml : 250;
  const time = drink ? hhmm(drink.ts) : defTime;
  const chips = state.settings.cups.map((ml) => `<button class="pill" data-pick="${ml}">${fmtMl(ml)}</button>`).join('');
  openSheet(`
    <div class="sheet-head"><h2>${drink ? 'Change drink' : 'Add a drink'}</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
    <div class="stepper">
      <button id="minus" aria-label="Decrease by 50 ml">−50</button>
      <div class="mid">
        <label for="amt">Amount</label>
        <div class="val"><input id="amt" type="number" inputmode="numeric" min="10" max="5000" step="10" value="${start}"><span class="unit">ml</span></div>
      </div>
      <button id="plus" aria-label="Increase by 50 ml">+50</button>
    </div>
    <div class="group"><span>Cups</span><div class="pills">${chips}</div></div>
    <div class="field"><label for="timeIn">Time</label><input id="timeIn" type="time" value="${time}" required></div>
    <button class="btn primary" id="saveDrink">${drink ? 'Save' : 'Add'}</button>
    ${drink ? '<button class="btn danger" id="delDrink">Delete this drink</button>' : ''}`, {
    label: drink ? 'Change drink' : 'Add a drink',
    onMount: (sheet) => {
      const amt = $('amt');
      const val = () => Math.max(10, Math.min(5000, Math.round(Number(amt.value) || 0)));
      $('minus').onclick = () => { amt.value = Math.max(10, val() - 50); };
      $('plus').onclick = () => { amt.value = Math.min(5000, val() + 50); };
      sheet.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => { amt.value = b.dataset.pick; }; });
      $('saveDrink').onclick = async () => {
        const t = $('timeIn').value || defTime;
        const ts = tsFor(key, t);
        if (ts > Date.now()) { showToast("That time hasn't happened yet"); return; }
        const ml = val();
        closeSheet();
        if (drink) {
          const before = await updateDrink(drink.id, { ml, ts });
          showToast(`Saved ${fmtMl(ml)} at ${t}`, { undo: () => updateDrink(drink.id, { ml: before.ml, ts: before.ts }) });
        } else {
          const d = await addDrink(ml, ts);
          showToast(`Added ${fmtMl(ml)} at ${t}`, { undo: () => undoAdd(d.id) });
        }
      };
      if (drink) $('delDrink').onclick = async () => {
        closeSheet();
        const d = await deleteDrink(drink.id);
        if (d) showToast(`Deleted ${fmtMl(d.ml)} · ${hhmm(d.ts)}`, { undo: () => restoreDrink(d.id) });
      };
    }
  });
}

// =========================================================
// Update 7: add a drink to any day (today or earlier).
// Cups like the Today page, "Other amount…", quick times or an exact
// time, and a preview of the day's new total before adding.
// =========================================================
const QUICK_TIMES = [['Morning', '09:00'], ['Noon', '12:00'], ['Afternoon', '15:00'], ['Evening', '19:00']];

export function openAddDrinkSheet(key) {
  const today = dayKey(Date.now());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '') || key > today) key = today;
  const isToday = key === today;
  const now = new Date();
  const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const minsOf = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const notYet = (t) => isToday && minsOf(t) > now.getHours() * 60 + now.getMinutes();
  const cups = state.settings.cups;
  let ml = cups.includes(500) ? 500 : cups[Math.min(2, cups.length - 1)];
  let time = isToday ? nowStr : '15:00';
  const dayName = keyDate(key).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  openSheet(`
    <div class="sheet-head"><div><h2>Add a drink</h2><span class="sheet-sub" id="addDayName">${isToday ? 'Today · ' : ''}${esc(dayName)}</span></div><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
    <div class="group"><span>How much</span>
      <div class="cup-grid sheet-cups" id="addCups">${cups.map((c) => `<button class="cup" data-add-ml="${c}" aria-pressed="false">${icons.cup(cupIconSize(c))}<span>${fmtMl(c)}</span></button>`).join('')}</div>
      <button class="custom-btn" id="otherAmt" aria-expanded="false">Other amount…</button>
      <div class="stepper hidden" id="otherBox">
        <button id="minus" aria-label="Decrease by 50 ml">−50</button>
        <div class="mid"><label for="amt">Amount</label><div class="val"><input id="amt" type="number" inputmode="numeric" min="10" max="5000" step="10" value="${ml}"><span class="unit">ml</span></div></div>
        <button id="plus" aria-label="Increase by 50 ml">+50</button>
      </div>
    </div>
    <div class="group"><div class="when-head"><span>When</span>
        <label class="exact">Exact time <input id="timeIn" type="time" value="${time}"></label></div>
      <div class="time-chips" id="timeChips">${QUICK_TIMES.map(([n, t]) => `<button data-time="${t}" aria-pressed="false" ${notYet(t) ? 'disabled' : ''}><b>${n}</b><span>${t}</span></button>`).join('')}</div>
    </div>
    <div class="day-preview" id="dayPreview"></div>
    <button class="btn primary" id="addIt"></button>`, {
    label: 'Add a drink to ' + dayName,
    onMount: (sheet) => {
      const amt = $('amt');
      const otherOpen = () => !$('otherBox').classList.contains('hidden');
      const sync = () => {
        sheet.querySelectorAll('[data-add-ml]').forEach((b) => {
          const on = !otherOpen() && Number(b.dataset.addMl) === ml;
          b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
        });
        sheet.querySelectorAll('[data-time]').forEach((b) => {
          const on = b.dataset.time === time; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
        });
        $('timeIn').value = time;
        const { goal } = goalFor(key);
        const before = drinksOn(key).reduce((s, d) => s + d.ml, 0);
        const after = before + ml;
        $('dayPreview').innerHTML = `<span>${isToday ? 'Today' : 'That day'} after this</span><b>${fmtL(after)} L${after > goal ? ` · <span class="x">+${fmtL(after - goal)} L extra</span>` : ` · ${Math.round(after / goal * 100)}%`}</b>`;
        $('addIt').textContent = `Add ${fmtMl(ml)} at ${time}`;
      };
      sheet.querySelectorAll('[data-add-ml]').forEach((b) => {
        b.onclick = () => { ml = Number(b.dataset.addMl); $('otherBox').classList.add('hidden'); $('otherAmt').setAttribute('aria-expanded', false); sync(); };
      });
      const val = () => Math.max(10, Math.min(5000, Math.round(Number(amt.value) || 0)));
      $('otherAmt').onclick = () => {
        const open = $('otherBox').classList.toggle('hidden') === false;
        $('otherAmt').setAttribute('aria-expanded', open);
        if (open) { amt.value = ml; amt.focus(); amt.select(); }
        sync();
      };
      amt.oninput = () => { ml = val(); sync(); };
      $('minus').onclick = () => { amt.value = ml = Math.max(10, val() - 50); sync(); };
      $('plus').onclick = () => { amt.value = ml = Math.min(5000, val() + 50); sync(); };
      sheet.querySelectorAll('[data-time]').forEach((b) => { b.onclick = () => { time = b.dataset.time; sync(); }; });
      $('timeIn').onchange = () => { if ($('timeIn').value) time = $('timeIn').value; sync(); };
      $('addIt').onclick = async () => {
        const ts = tsFor(key, time);
        if (ts > Date.now()) { showToast("That time hasn't happened yet"); return; }
        closeSheet();
        const d = await addDrink(ml, ts);
        showToast(`Added ${fmtMl(ml)} at ${time}${isToday ? '' : ' · ' + keyDate(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`, { undo: () => undoAdd(d.id) });
      };
      sync();
    }
  });
}
