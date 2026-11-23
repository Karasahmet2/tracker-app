// =========================================================
// Notes (Update 6): quick thoughts, newest at the top.
// Write in the box at the top, pick a colour, Save (or Enter).
// Search by words, filter by colour, tap a note to edit,
// recolour or delete it (deleted notes go to the Trash).
// Address: #/notes, or #/notes/2026-11-20 to jump to a day.
// =========================================================
import { state, addNote, updateNote, deleteNote, undoAddNote, restoreItem, setSetting, NOTE_COLORS } from './state.js';
import { $, esc, icons, hhmm, dayKey, longDate, openSheet, closeSheet, showToast } from './ui.js';

const COLOR_NAME = { plain: 'Plain', yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink', purple: 'Purple' };

let query = '';            // search words (kept while you move around the app)
let colorFilter = null;    // one colour, or null for all
let draft = '';            // unsaved text in the quick box
let justAdded = null;

export const swatchRow = (selected, name) => NOTE_COLORS.map((c) =>
  `<button type="button" class="swatch-dot c-${c} ${c === selected ? 'on' : ''}" data-${name}="${c}" aria-label="${COLOR_NAME[c]}" aria-pressed="${c === selected}"></button>`).join('');

const dayTitle = (key) => {
  const today = dayKey(Date.now());
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (key === today) return 'Today';
  if (key === dayKey(y.getTime())) return 'Yesterday';
  const [Y, M, D] = key.split('-').map(Number);
  const d = new Date(Y, M - 1, D);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(Y !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
};

// Highlight search words inside already-escaped text
function highlight(text, words) {
  let html = esc(text);
  words.forEach((w) => {
    const re = new RegExp('(' + esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    html = html.replace(re, '<mark>$1</mark>');
  });
  return html;
}

export function noteCard(n, words = []) {
  return `<li class="note c-${n.color} ${n.id === justAdded ? 'new' : ''}" data-note="${n.id}">
      <button class="note-body" aria-label="Edit note from ${hhmm(n.ts)}">
        <span class="note-text">${highlight(n.text, words)}</span>
        <span class="note-meta"><i class="dot"></i>${hhmm(n.ts)}${n.edited ? ` · edited ${dayKey(n.edited) === dayKey(n.ts) ? hhmm(n.edited) : new Date(n.edited).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</span>
      </button>
    </li>`;
}

export function mountNotes(view, params = []) {
  const jump = /^\d{4}-\d{2}-\d{2}$/.test(params[0] || '') ? params[0] : null;
  view.innerHTML = `
    <header class="head">
      <div><div class="date">${esc(longDate())}</div><h1>Notes</h1></div>
      <div class="head-right"><button class="icon-btn ${query ? 'on' : ''}" id="searchBtn" aria-label="Search notes" aria-expanded="${!!query}">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" style="stroke:var(--text-2)" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button></div>
    </header>
    <div class="search-row ${query ? '' : 'hidden'}" id="searchRow">
      <label for="searchIn" class="sr-only">Search notes</label>
      <input id="searchIn" type="search" placeholder="Search notes" value="${esc(query)}" autocomplete="off" enterkeyhint="search">
      <button class="pill-btn" id="searchClose">Done</button>
    </div>
    <form class="quick" id="quick">
      <label for="quickIn" class="sr-only">New note</label>
      <textarea id="quickIn" rows="2" placeholder="What's on your mind?" enterkeyhint="done">${esc(draft)}</textarea>
      <div class="quick-row">
        <div class="swatches" id="quickColors">${swatchRow(state.settings.noteColor, 'qc')}</div>
        <button class="btn note-save" id="quickSave" type="submit">Save</button>
      </div>
    </form>
    <div class="note-filters" id="noteFilters"></div>
    <div class="note-list" id="noteList"></div>`;

  const quickIn = $('quickIn');
  const grow = () => { quickIn.style.height = 'auto'; quickIn.style.height = Math.min(quickIn.scrollHeight, 180) + 'px'; };
  quickIn.oninput = () => { draft = quickIn.value; grow(); };
  // Enter saves; Shift+Enter makes a new line
  quickIn.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('quick').requestSubmit(); } };
  $('quick').onsubmit = async (e) => {
    e.preventDefault();
    const text = quickIn.value.trim();
    if (!text) { quickIn.focus(); return; }
    const n = await addNote(text, state.settings.noteColor);
    justAdded = n.id;
    draft = ''; quickIn.value = ''; grow();
    update();
    justAdded = null;
    showToast('Note saved', { undo: () => undoAddNote(n.id) });
  };
  $('quickColors').onclick = (e) => {
    const b = e.target.closest('[data-qc]');
    if (!b) return;
    setSetting('noteColor', b.dataset.qc);
    $('quickColors').innerHTML = swatchRow(b.dataset.qc, 'qc');
    quickIn.focus();
  };

  $('searchBtn').onclick = () => {
    const row = $('searchRow');
    const open = row.classList.toggle('hidden') === false;
    $('searchBtn').setAttribute('aria-expanded', open);
    $('searchBtn').classList.toggle('on', open);
    if (open) $('searchIn').focus(); else { query = ''; $('searchIn').value = ''; update(); }
  };
  $('searchIn').oninput = () => { query = $('searchIn').value; update(); };
  $('searchClose').onclick = () => { query = ''; $('searchIn').value = ''; $('searchRow').classList.add('hidden'); $('searchBtn').classList.remove('on'); $('searchBtn').setAttribute('aria-expanded', false); update(); };

  $('noteFilters').onclick = (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    colorFilter = b.dataset.filter === 'all' || colorFilter === b.dataset.filter ? null : b.dataset.filter;
    update();
  };
  $('noteList').onclick = (e) => {
    const li = e.target.closest('[data-note]');
    if (li) openNoteSheet(state.notes.find((n) => n.id === li.dataset.note));
  };

  grow();
  update();
  if (jump) {
    // after the router has finished opening the page
    setTimeout(() => {
      const el = document.querySelector(`[data-day-group="${jump}"]`);
      if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('flash'); }
    }, 0);
  }
  return { update, destroy() {} };
}

function update() {
  if (!$('noteList')) return;
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  // colour chips with counts
  const counts = {};
  state.notes.forEach((n) => { counts[n.color] = (counts[n.color] || 0) + 1; });
  $('noteFilters').innerHTML = `<button class="chip-all ${colorFilter ? '' : 'on'}" data-filter="all" aria-pressed="${!colorFilter}">All · ${state.notes.length}</button>` +
    NOTE_COLORS.filter((c) => counts[c]).map((c) =>
      `<button class="chip-color ${colorFilter === c ? 'on' : ''}" data-filter="${c}" aria-pressed="${colorFilter === c}" aria-label="Only ${COLOR_NAME[c].toLowerCase()} notes (${counts[c]})"><i class="dot c-${c}"></i>${counts[c]}</button>`).join('');

  const list = state.notes.filter((n) =>
    (!colorFilter || n.color === colorFilter) &&
    words.every((w) => n.text.toLowerCase().includes(w)));

  if (!state.notes.length) {
    $('noteList').innerHTML = `<p class="empty">No notes yet. Write the first thought in the box above.</p>`;
    return;
  }
  if (!list.length) {
    $('noteList').innerHTML = `<p class="empty">No notes match${words.length ? ` “${esc(query.trim())}”` : ''}${colorFilter ? ` in ${COLOR_NAME[colorFilter].toLowerCase()}` : ''}.</p>`;
    return;
  }
  // group by the day each note was written
  const groups = [];
  list.forEach((n) => {
    const k = dayKey(n.ts);
    if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, notes: [] });
    groups[groups.length - 1].notes.push(n);
  });
  $('noteList').innerHTML = (words.length ? `<p class="result-count" role="status">${list.length} note${list.length === 1 ? '' : 's'} found</p>` : '') +
    groups.map((g) => `<section class="note-day" data-day-group="${g.key}">
      <h2>${esc(dayTitle(g.key))}</h2>
      <ul>${g.notes.map((n) => noteCard(n, words)).join('')}</ul>
    </section>`).join('');
}

// =========================================================
// Edit / recolour / delete a note
// =========================================================
export function openNoteSheet(n) {
  if (!n) return;
  let color = n.color;
  const written = new Date(n.ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + hhmm(n.ts);
  const edited = n.edited ? new Date(n.edited).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' + hhmm(n.edited) : '—';
  openSheet(`
    <div class="sheet-head"><h2>Edit note</h2><button class="icon-btn" data-close aria-label="Close">${icons.close}</button></div>
    <label for="noteText" class="sr-only">Note</label>
    <textarea id="noteText" class="note-edit c-${color}" rows="6">${esc(n.text)}</textarea>
    <div class="group"><span>Colour</span><div class="swatches big" id="editColors">${swatchRow(color, 'ec')}</div></div>
    <div class="note-times">
      <div><span>Written</span><b>${written}</b></div>
      <div><span>Last edited</span><b>${edited}</b></div>
    </div>
    <div class="btn-row">
      <button class="btn danger" id="delNote">Delete</button>
      <button class="btn note-save" id="saveNote">Save</button>
    </div>`, {
    label: 'Edit note',
    onMount: () => {
      const ta = $('noteText');
      $('editColors').onclick = (e) => {
        const b = e.target.closest('[data-ec]');
        if (!b) return;
        color = b.dataset.ec;
        $('editColors').innerHTML = swatchRow(color, 'ec');
        ta.className = `note-edit c-${color}`;
      };
      $('saveNote').onclick = async () => {
        const text = ta.value.trim();
        if (!text) { showToast('A note needs some text — or delete it'); return; }
        closeSheet();
        if (text === n.text && color === n.color) return;
        const before = await updateNote(n.id, { text, color });
        showToast('Note saved', { undo: () => updateNote(n.id, { text: before.text, color: before.color, edited: before.edited }) });
      };
      $('delNote').onclick = async () => {
        closeSheet();
        const d = await deleteNote(n.id);
        if (d) showToast('Note deleted', { undo: () => restoreItem(d.id) });
      };
    }
  });
}
