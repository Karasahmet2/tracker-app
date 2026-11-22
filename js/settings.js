// =========================================================
// Settings sheet, plus Trash and Backup sheets opened from it.
// =========================================================
import { state, setSetting, setGoal, setRunGoal, restoreItem, reloadAll } from './state.js';
import { applyTheme, THEMES } from './themes.js';
import * as db from './db.js';
import { $, esc, icons, fmtMl, hhmm, openSheet, closeSheet, showToast } from './ui.js';
import { saveBackup, loadBackup } from './backup.js';
import { APP_VERSION } from './version.js';

const head = (title) =>
  `<div class="sheet-head"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>`;

export function openSettings() {
  const s = state.settings;
  const cupPills = s.cups.map((ml) =>
    `<button class="pill" data-rm="${ml}" aria-label="Remove ${fmtMl(ml)} cup">${fmtMl(ml)}<span class="x" aria-hidden="true">×</span></button>`).join('');
  openSheet(`
    ${head('Settings')}
    <div class="group"><span>Theme</span><div class="themes" id="themePick">${THEMES.map((t) => `
      <button class="theme-chip ${s.theme === t.id ? 'on' : ''}" data-theme-pick="${t.id}" aria-pressed="${s.theme === t.id}" aria-label="${t.name} theme">
        <span class="swatch" style="background:${t.bg}"><i style="background:${t.water}"></i><i style="background:${t.extra}"></i></span>${t.name}
      </button>`).join('')}</div></div>
    <div class="field"><label for="goalIn">Daily goal (L)</label><input id="goalIn" type="number" inputmode="decimal" min="0.5" max="6" step="0.1" value="${s.goal / 1000}"></div>
    <div class="field"><label for="bonusIn">Bonus bottle (L)</label><input id="bonusIn" type="number" inputmode="decimal" min="0.25" max="3" step="0.25" value="${s.bonus / 1000}"></div>
    <p class="hint">A new goal counts from today. Past days keep the goal they had.</p>
    <div class="field"><label for="runGoalIn">Running goal (km / week)</label><input id="runGoalIn" type="number" inputmode="decimal" min="1" max="200" step="1" value="${s.runGoal}"></div>
    <div class="field"><label for="runBonusIn">Bonus lap (km)</label><input id="runBonusIn" type="number" inputmode="decimal" min="1" max="100" step="1" value="${s.runBonus}"></div>
    <p class="hint">A new running goal counts from this week. Past weeks keep theirs.</p>
    <label class="check"><input type="checkbox" id="askIn" ${s.ask ? 'checked' : ''}><span><b>Ask before adding a cup</b><small>Shows "Add 330 ml?" so a mis-tap doesn't count</small></span></label>
    <div class="group"><span>Cup buttons — tap one to remove it</span><div class="pills" id="cupPills">${cupPills}</div></div>
    <button class="row-btn" id="openTrash">Trash <span>Deleted drinks and runs, kept 30 days ›</span></button>
    <button class="row-btn" id="openBackup">Backup <span>Save or load your data ›</span></button>
    <p class="foot-note" style="margin:0">Version ${esc(APP_VERSION)} · Your data stays on this phone.</p>`, {
    label: 'Settings',
    onMount: () => {
      $('goalIn').onchange = () => {
        const v = Math.round(Number($('goalIn').value) * 1000);
        if (v >= 500 && v <= 6000) setGoal({ goal: v }); else { $('goalIn').value = s.goal / 1000; showToast('Pick a goal between 0.5 and 6 L'); }
      };
      $('bonusIn').onchange = () => {
        const v = Math.round(Number($('bonusIn').value) * 1000);
        if (v >= 250 && v <= 3000) setGoal({ bonus: v }); else { $('bonusIn').value = s.bonus / 1000; showToast('Pick a bonus between 0.25 and 3 L'); }
      };
      $('askIn').onchange = () => setSetting('ask', $('askIn').checked);
      $('runGoalIn').onchange = () => {
        const v = Math.round(Number($('runGoalIn').value) * 10) / 10;
        if (v >= 1 && v <= 200) setRunGoal({ goal: v }); else { $('runGoalIn').value = s.runGoal; showToast('Pick a goal between 1 and 200 km'); }
      };
      $('runBonusIn').onchange = () => {
        const v = Math.round(Number($('runBonusIn').value) * 10) / 10;
        if (v >= 1 && v <= 100) setRunGoal({ bonus: v }); else { $('runBonusIn').value = s.runBonus; showToast('Pick a bonus lap between 1 and 100 km'); }
      };
      $('themePick').onclick = (ev) => {
        const b = ev.target.closest('[data-theme-pick]');
        if (!b) return;
        setSetting('theme', b.dataset.themePick);
        applyTheme(b.dataset.themePick);
        $('themePick').querySelectorAll('[data-theme-pick]').forEach((x) => {
          const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on);
        });
      };
      $('cupPills').onclick = (ev) => {
        const b = ev.target.closest('[data-rm]');
        if (!b) return;
        if (state.settings.cups.length <= 1) { showToast('Keep at least one cup'); return; }
        const ml = Number(b.dataset.rm);
        const before = state.settings.cups;
        setSetting('cups', before.filter((x) => x !== ml));
        b.remove();
        showToast(`Removed the ${fmtMl(ml)} cup`, { undo: () => setSetting('cups', before) });
      };
      $('openTrash').onclick = openTrash;
      $('openBackup').onclick = openBackup;
    }
  });
}

async function openTrash() {
  const items = (await db.trashList()).sort((a, b) => b.deletedAt - a.deletedAt);
  const daysLeft = (t) => Math.max(0, 30 - Math.floor((Date.now() - t.deletedAt) / 864e5));
  const when = (t) => `${new Date(t.ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${hhmm(t.ts)}`;
  const rows = items.map((t) => `
    <li class="entry">
      <div class="ico ${t.kind === 'run' ? 'run' : ''}">${t.kind === 'run' ? icons.run : icons.cup(20)}</div>
      <div class="what"><b>${t.kind === 'run' ? `${Number(t.km).toFixed(1)} km run` : fmtMl(t.ml)}</b><span>${when(t)} · ${daysLeft(t)} days left</span></div>
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
        if (t) showToast(t.kind === 'run' ? `Restored the ${Number(t.km).toFixed(1)} km run` : `Restored ${fmtMl(t.ml)}`);
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

function openBackup() {
  openSheet(`
    ${head('Backup')}
    <p style="margin:0;color:var(--text-2);font-size:14px;line-height:1.5">Save a backup file before big updates. Loading a backup replaces everything in the app with what's in the file.</p>
    <button class="btn primary" id="saveBk">Save backup file</button>
    <label class="btn" style="display:flex;align-items:center;justify-content:center;cursor:pointer">Load a backup…<input type="file" id="loadBk" accept="application/json,.json" class="hidden"></label>`, {
    label: 'Backup',
    onMount: () => {
      $('saveBk').onclick = async () => { const name = await saveBackup(); showToast(`Saved ${name}`); };
      $('loadBk').onchange = async () => {
        const file = $('loadBk').files[0];
        if (!file) return;
        if (!window.confirm('Replace all your data with this backup?')) { $('loadBk').value = ''; return; }
        try {
          const n = await loadBackup(file);
          await reloadAll();
          closeSheet();
          showToast(`Backup loaded · ${n} drinks`);
        } catch (e) {
          showToast(e.message || 'Could not load that file');
        }
      };
    }
  });
}
