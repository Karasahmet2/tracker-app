// =========================================================
// Notes calendar (Update 6): month only. Each day shows a small
// coloured stripe per note. Tap a day to see its notes under the month.
// Address: #/calendar/notes/month/2026-11-20 (that day is selected)
// =========================================================
import { state, notesOn } from './state.js';
import { $, dayKey } from './ui.js';
import { shell, href, keyToDate, isKey, addDays, mondayOf, todayKey, isFuture } from './calendar.js';
import { noteCard, openNoteSheet } from './notes.js';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function mountNotesCalendar(view, params = []) {
  let key = params[1];
  if (!isKey(key) || isFuture(key)) key = todayKey();
  const draw = () => {
    const focus = keyToDate(key);
    const first = new Date(focus.getFullYear(), focus.getMonth(), 1);
    const days = new Date(focus.getFullYear(), focus.getMonth() + 1, 0).getDate();
    const today = todayKey();
    const byDay = {};
    state.notes.forEach((n) => { const k = dayKey(n.ts); (byDay[k] = byDay[k] || []).push(n); });
    let monthCount = 0;
    for (let d = 1; d <= days; d++) monthCount += (byDay[dayKey(new Date(first.getFullYear(), first.getMonth(), d))] || []).length;

    const prev = dayKey(new Date(first.getFullYear(), first.getMonth() - 1, 1));
    const nf = new Date(first.getFullYear(), first.getMonth() + 1, 1);
    view.innerHTML = shell('month', key, {
      habit: 'notes',
      legend: '<span><i class="stripe-i"></i>One stripe per note, in its colour</span>',
      label: first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      right: `${monthCount} note${monthCount === 1 ? '' : 's'}`,
      prevKey: prev, nextKey: dayKey(nf) <= today ? dayKey(nf) : null
    });

    const start = mondayOf(first);
    const rows = Math.ceil(((first.getDay() + 6) % 7 + days) / 7);
    let cells = '';
    for (let i = 0; i < rows * 7; i++) {
      const date = addDays(start, i), k = dayKey(date);
      const list = (byDay[k] || []).slice().sort((a, b) => a.ts - b.ts);
      const other = date.getMonth() !== first.getMonth(), future = isFuture(k);
      const cls = ['mcell', 'ncell', other && 'other', future && 'future', k === today && 'today', k === key && 'selected'].filter(Boolean).join(' ');
      const stripes = list.slice(0, 4).map((n, j) => `<i class="c-${n.color}" style="animation-delay:${i * 20 + j * 60}ms"></i>`).join('');
      const inner = `<span class="mnum">${date.getDate()}</span>
        ${list.length ? `<div class="stripes" style="height:${Math.min(10 + 6 * list.length, 26)}px">${stripes}</div>` : ''}
        ${list.length > 4 ? `<span class="more">+${list.length - 4}</span>` : ''}`;
      const aria = `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, ${list.length} note${list.length === 1 ? '' : 's'}`;
      cells += future ? `<span class="${cls}" aria-label="${aria}" data-day="${k}">${inner}</span>`
        : `<a class="${cls}" href="${href('month', k, 'notes')}" aria-label="${aria}" aria-current="${k === key ? 'date' : 'false'}" data-day="${k}">${inner}</a>`;
    }
    const sel = (byDay[key] || []).slice().sort((a, b) => b.ts - a.ts);
    const selDate = keyToDate(key).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    $('calBody').innerHTML = `
      <div class="mgrid weekdays">${WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="mgrid" id="monthGrid">${cells}</div>
      <div class="day-notes-head"><h2 id="selDay">${selDate}</h2>${sel.length ? `<a href="#/notes/${key}" id="showInList">Show in list ›</a>` : ''}</div>
      <ul class="day-notes" id="dayNotes">${sel.length ? sel.map((n) => noteCard(n)).join('') : '<li class="empty">No notes on this day.</li>'}</ul>`;
    $('dayNotes').onclick = (e) => {
      const li = e.target.closest('[data-note]');
      if (li) openNoteSheet(state.notes.find((n) => n.id === li.dataset.note));
    };
  };
  draw();
  return { update: draw, destroy() {} };
}
