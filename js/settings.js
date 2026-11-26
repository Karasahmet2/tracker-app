// =========================================================
// Settings page (Update 8), plus Trash and Backup sheets.
// =========================================================
import { state, setSetting, setGoal, setRunGoal, restoreItem, reloadAll } from './state.js';
import { applyTheme, THEMES } from './themes.js';
import * as db from './db.js';
import { $, esc, icons, fmtMl, hhmm, openSheet, closeSheet, showToast, goBack } from './ui.js';
import { saveBackup, loadBackup } from './backup.js';
import { safety, askPersist, checkPersisted, lastBackupText, backupDue } from './safety.js';
import { APP_VERSION } from './version.js';

const head = (title) =>
  `<div class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>`;

// Update 8: Settings is its own page (#/settings), reached from the gear on every tab.
export function openSettings() { location.hash = '#/settings'; }

const NOTE_COLOURS = [['plain', 'Plain'], ['yellow', 'Yellow'], ['green', 'Green'], ['blue', 'Blue'], ['pink', 'Pink'], ['purple', 'Purple']];
const START_PAGES = [['water', 'Water'], ['running', 'Running'], ['notes', 'Notes'], ['calendar', 'Calendar']];
const box = (id, title, dot, body, sub = '') =>
  `<section class="set-box" id="${id}" aria-labelledby="${id}-h"><div class="set-head"><i class="set-dot ${dot}"></i><h2 id="${id}-h">${title}</h2>${sub ? `<span>${sub}</span>` : ''}</div>${body}</section>`;
const numRow = (id, label, value, unit, attrs) =>
  `<div class="set-row"><label for="${id}">${label}</label><div class="num"><input id="${id}" type="number" inputmode="decimal" value="${value}" ${attrs}><span>${unit}</span></div></div>`;

export function mountSettings(view) {
  let alive = true;                       // false once you leave the page
  const draw = async () => {
    const s = state.settings;
    const trashCount = (await db.trashList()).length;
    if (!alive) return;                   // you left while the Trash was being counted
    const due = backupDue();
    view.innerHTML = `
    <header class="log-head">
      <a class="icon-btn" href="#/water" id="setBack" aria-label="Back">${icons.back}</a>
      <div><h1>Settings</h1></div>
    </header>
    <div class="settings">
    ${box('setData', 'Your data', 'amber', `
      <div class="backup-card ${due ? 'due' : ''}">
        <div class="bc-top">${icons.backup}<div><b>Back up now</b><span id="lastBackup">Last backup: ${lastBackupText()}</span></div></div>
        <div class="bc-btns">
          <button class="btn bc-save" id="saveBk">Save to Drive / Files</button>
          <label class="btn bc-load">Load a backup<input type="file" id="loadBk" accept="application/json,.json" class="hidden"></label>
        </div>
      </div>
      <div class="set-row"><div><b>Protected from clean-up</b><small>Chrome won't clear it to free space</small></div><span id="persistState">Checking…</span></div>
      <button class="set-row link" id="openTrash"><div><b>Trash</b><small>Deleted drinks, runs and notes · 30 days</small></div><span>${trashCount} item${trashCount === 1 ? '' : 's'} ›</span></button>
      <p class="hint">Saved in Chrome at <b>${esc(location.host)}</b>. Clearing Chrome's data for this site clears every app at this address, so keep backups.</p>`)}
    ${box('setGeneral', 'General', 'grey', `
      <div class="themes" id="themePick">${THEMES.map((t) => `
        <button class="theme-chip ${s.theme === t.id ? 'on' : ''}" data-theme-pick="${t.id}" aria-pressed="${s.theme === t.id}" aria-label="${t.name} theme">
          <span class="swatch" style="background:${t.bg}"><i style="background:${t.water}"></i><i style="background:${t.extra}"></i></span>${t.name}
        </button>`).join('')}</div>
      <div class="set-row"><label for="startIn"><b>Start page</b><small>The tab the app opens on</small></label>
        <select id="startIn">${START_PAGES.map(([v, n]) => `<option value="${v}" ${(s.startPage || 'water') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`, 'Theme · for every page')}
    ${box('setWater', 'Water', 'water', `
      ${numRow('goalIn', 'Daily goal', s.goal / 1000, 'L', 'min="0.5" max="6" step="0.1"')}
      ${numRow('bonusIn', 'Bonus bottle', s.bonus / 1000, 'L', 'min="0.25" max="3" step="0.25"')}
      <p class="hint">A new goal counts from today. Past days keep theirs.</p>
      <div class="set-row"><label for="askIn"><b>Ask before adding a cup</b><small>Shows "Add 330 ml?" first</small></label>
        <input type="checkbox" role="switch" class="switch" id="askIn" ${s.ask ? 'checked' : ''}></div>
      <div class="group"><span>Cup buttons</span><div class="pills" id="cupPills">${s.cups.map((ml) =>
        `<button class="pill" data-rm="${ml}" aria-label="Remove ${fmtMl(ml)} cup">${fmtMl(ml)}<span class="x" aria-hidden="true">×</span></button>`).join('')}
        ${s.cups.length < 8 ? '<button class="pill add" id="addCup">+ Add cup</button>' : ''}</div></div>`)}
    ${box('setRun', 'Running', 'run', `
      ${numRow('runGoalIn', 'Weekly goal', s.runGoal, 'km', 'min="1" max="200" step="1"')}
      ${numRow('runBonusIn', 'Bonus lap', s.runBonus, 'km', 'min="1" max="100" step="1"')}
      <p class="hint">A new goal counts from this week. Past weeks keep theirs.</p>`)}
    ${box('setNotes', 'Notes', 'note', `
      <div class="group"><span>Colour for new notes</span><div class="swatches big" id="noteColorPick">${NOTE_COLOURS.map(([c, n]) =>
        `<button type="button" class="swatch-dot c-${c} ${s.noteColor === c ? 'on' : ''}" data-nc="${c}" aria-label="${n}" aria-pressed="${s.noteColor === c}"></button>`).join('')}</div></div>`)}
    ${box('setAbout', 'About', 'grey', `<div class="set-row"><span>Version</span><b id="appVersion">${esc(APP_VERSION)}</b></div>`)}
    </div>`;
    wire(s);
  };

  function wire(s) {
    $('setBack').onclick = (e) => { e.preventDefault(); goBack('/water'); };
    // your data
    $('saveBk').onclick = async () => {
      const name = await saveBackup({ useShare: true });
      if (!name) return;
      await reloadAll();
      showToast(`Saved ${name}`);
    };
    $('loadBk').onchange = () => loadFromInput($('loadBk'));
    $('openTrash').onclick = openTrash;
    const showPersist = () => {
      const el = $('persistState'); if (!el) return;
      if (safety.persisted) { el.textContent = 'On ✓'; el.className = 'ok'; return; }
      el.innerHTML = safety.supported ? '<button class="pill" id="askPersist">Turn on</button>' : 'Not available';
      const b = $('askPersist');
      if (b) b.onclick = async () => { const ok = await askPersist(); showPersist(); if (!ok) showToast('Chrome said not yet. Installing the app to your home screen usually allows it.'); };
    };
    checkPersisted().then(showPersist);
    // general
    $('themePick').onclick = (ev) => {
      const b = ev.target.closest('[data-theme-pick]');
      if (!b) return;
      setSetting('theme', b.dataset.themePick);
      applyTheme(b.dataset.themePick);
      $('themePick').querySelectorAll('[data-theme-pick]').forEach((x) => {
        const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on);
      });
    };
    $('startIn').onchange = () => setSetting('startPage', $('startIn').value);
    // water
    $('goalIn').onchange = () => {
      const v = Math.round(Number($('goalIn').value) * 1000);
      if (v >= 500 && v <= 6000) setGoal({ goal: v }); else { $('goalIn').value = s.goal / 1000; showToast('Pick a goal between 0.5 and 6 L'); }
    };
    $('bonusIn').onchange = () => {
      const v = Math.round(Number($('bonusIn').value) * 1000);
      if (v >= 250 && v <= 3000) setGoal({ bonus: v }); else { $('bonusIn').value = s.bonus / 1000; showToast('Pick a bonus between 0.25 and 3 L'); }
    };
    $('askIn').onchange = () => setSetting('ask', $('askIn').checked);
    $('cupPills').onclick = (ev) => {
      if (ev.target.closest('#addCup')) { openAddCup(); return; }
      const b = ev.target.closest('[data-rm]');
      if (!b) return;
      if (state.settings.cups.length <= 1) { showToast('Keep at least one cup'); return; }
      const ml = Number(b.dataset.rm);
      const before = state.settings.cups;
      setSetting('cups', before.filter((x) => x !== ml));
      showToast(`Removed the ${fmtMl(ml)} cup`, { undo: () => setSetting('cups', before) });
    };
    // running
    $('runGoalIn').onchange = () => {
      const v = Math.round(Number($('runGoalIn').value) * 10) / 10;
      if (v >= 1 && v <= 200) setRunGoal({ goal: v }); else { $('runGoalIn').value = s.runGoal; showToast('Pick a goal between 1 and 200 km'); }
    };
    $('runBonusIn').onchange = () => {
      const v = Math.round(Number($('runBonusIn').value) * 10) / 10;
      if (v >= 1 && v <= 100) setRunGoal({ bonus: v }); else { $('runBonusIn').value = s.runBonus; showToast('Pick a bonus lap between 1 and 100 km'); }
    };
    // notes
    $('noteColorPick').onclick = (ev) => { const b = ev.target.closest('[data-nc]'); if (b) setSetting('noteColor', b.dataset.nc); };
  }

  // redraw on changes, but never while a number is being typed
  let pending = false;
  const update = () => {
    const a = document.activeElement;
    if (a && a.tagName === 'INPUT' && a.type === 'number' && view.contains(a)) { pending = true; return; }
    draw();
  };
  const onBlur = (e) => { if (pending && e.target.tagName === 'INPUT') { pending = false; setTimeout(draw, 0); } };
  view.addEventListener('focusout', onBlur);
  draw();
  return { update, destroy: () => { alive = false; view.removeEventListener('focusout', onBlur); } };
}

function openAddCup() {
  openSheet(`
    ${head('Add a cup button')}
    <div class="stepper">
      <button id="minus" aria-label="Decrease by 50 ml">−50</button>
      <div class="mid"><label for="cupAmt">Amount</label><div class="val"><input id="cupAmt" type="number" inputmode="numeric" min="10" max="3000" step="10" value="250"><span class="unit">ml</span></div></div>
      <button id="plus" aria-label="Increase by 50 ml">+50</button>
    </div>
    <button class="btn primary" id="saveCupBtn">Add cup</button>`, {
    label: 'Add a cup button',
    onMount: () => {
      const amt = $('cupAmt');
      const val = () => Math.max(10, Math.min(3000, Math.round(Number(amt.value) || 0)));
      $('minus').onclick = () => { amt.value = Math.max(10, val() - 50); };
      $('plus').onclick = () => { amt.value = Math.min(3000, val() + 50); };
      $('saveCupBtn').onclick = () => {
        const v = val();
        closeSheet();
        if (state.settings.cups.includes(v)) { showToast(`You already have a ${fmtMl(v)} cup`); return; }
        setSetting('cups', [...state.settings.cups, v].sort((a, b) => a - b));
        showToast(`Added a ${fmtMl(v)} cup`);
      };
    }
  });
}

async function loadFromInput(input) {
  const file = input.files[0];
  if (!file) return;
  if (!window.confirm('Replace all your data with this backup?')) { input.value = ''; return; }
  try {
    const n = await loadBackup(file);
    await reloadAll();
    closeSheet();
    showToast(`Backup loaded · ${n} drinks`);
  } catch (e) {
    input.value = '';
    showToast(e.message || 'Could not load that file');
  }
}

async function openTrash() {
  const items = (await db.trashList()).sort((a, b) => b.deletedAt - a.deletedAt);
  const daysLeft = (t) => Math.max(0, 30 - Math.floor((Date.now() - t.deletedAt) / 864e5));
  const when = (t) => `${new Date(t.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${hhmm(t.ts)}`;
  const rows = items.map((t) => `
    <li class="entry">
      <div class="ico ${t.kind === 'run' ? 'run' : t.kind === 'note' ? 'note-ico c-' + esc(t.color || 'plain') : ''}">${t.kind === 'run' ? icons.run : t.kind === 'note' ? icons.note : icons.cup(20)}</div>
      <div class="what"><b>${t.kind === 'run' ? `${Number(t.km).toFixed(1)} km run` : t.kind === 'note' ? esc(String(t.text).slice(0, 40)) + (String(t.text).length > 40 ? '…' : '') : fmtMl(t.ml)}</b><span>${when(t)} · ${daysLeft(t)} days left</span></div>
      <button class="restore" data-restore="${t.id}">Restore</button>
    </li>`).join('');
  openSheet(`
    ${head('Trash')}
    <ul class="entries" id="trashList">${rows || '<li class="empty">Trash is empty.</li>'}</ul>
    ${items.length ? '<button class="btn danger" id="emptyTrash">Empty Trash now</button>' : ''}`, {
    label: 'Trash',
    onMount: () => {
      $('trashList').onclick = async (ev) => {
        const b = ev.target.closest('[data-restore]');
        if (!b) return;
        const t = await restoreItem(b.dataset.restore);
        b.closest('li').remove();
        if (t) showToast(t.kind === 'run' ? `Restored the ${Number(t.km).toFixed(1)} km run` : t.kind === 'note' ? 'Restored the note' : `Restored ${fmtMl(t.ml)}`);
        if (!$('trashList').children.length) $('trashList').innerHTML = '<li class="empty">Trash is empty.</li>';
      };
      const empty = $('emptyTrash');
      if (empty) empty.onclick = async () => {
        if (!window.confirm('Delete everything in the Trash for good?')) return;
        await db.emptyTrash();
        closeSheet();
        showToast('Trash emptied');
      };
    }
  });
}

export function openBackup() {
  openSheet(`
    ${head('Backup')}
    <p style="margin:0;color:var(--text-2);font-size:14px;line-height:1.5">Save a backup file before big updates. Loading a backup replaces everything in the app with what's in the file.</p>
    <button class="btn primary" id="sheetSaveBk">Save to Drive / Files</button>
    <label class="btn" style="display:flex;align-items:center;justify-content:center;cursor:pointer">Load a backup…<input type="file" id="sheetLoadBk" accept="application/json,.json" class="hidden"></label>`, {
    label: 'Backup',
    onMount: () => {
      $('sheetSaveBk').onclick = async () => {
        const name = await saveBackup({ useShare: true });
        if (!name) return;
        closeSheet();
        await reloadAll();
        showToast(`Saved ${name}`);
      };
      $('sheetLoadBk').onchange = () => loadFromInput($('sheetLoadBk'));
    }
  });
}
