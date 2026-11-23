// Update 6: the notes calendar is month only — a stripe per note in its colour; tap a day to see its notes.
const { openApp, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-23T17:00:00' });
  try {
    await page.goto(url + '#/notes');
    await page.waitForSelector('#quickIn');
    await page.evaluate(() => new Promise((res) => {
      const r = indexedDB.open('tracker');
      r.onsuccess = () => {
        const tx = r.result.transaction('notes', 'readwrite');
        [['2026-11-20T19:55', 'pink', 'Gift idea: ceramic mug workshop voucher.'], ['2026-11-20T09:12', 'plain', 'Orange for running.'],
         ['2026-11-16T10:00', 'yellow', 'a'], ['2026-11-16T11:00', 'blue', 'b'], ['2026-11-16T12:00', 'green', 'c'], ['2026-11-16T13:00', 'pink', 'd'], ['2026-11-16T14:00', 'plain', 'e'],
         ['2026-11-23T08:00', 'green', 'Today note']]
          .forEach(([t, c, x], i) => tx.objectStore('notes').put({ id: 'k' + i, ts: new Date(t).getTime(), edited: null, text: x, color: c }));
        tx.oncomplete = res;
      };
    }));
    await page.reload();
    await page.waitForSelector('.note');
    // the Calendar tab opens the notes calendar after visiting Notes
    await page.locator('#nav a[data-tab="calendar"]').click();
    await page.waitForSelector('#monthGrid');
    assert(page.url().includes('#/calendar/notes'), 'notes calendar');
    assert(await page.locator('.zoom.hidden').count() === 1, 'month only: no Day/Week/Month switch');
    eq(await text(page, '.period-right'), '8 notes', 'month count');
    const d20 = page.locator('[data-day="2026-11-20"] .stripes i');
    eq(await d20.count(), 2, 'two stripes on the 20th');
    assert(await d20.first().evaluate((el) => el.classList.contains('c-plain')), 'in time order, own colour');
    eq(await page.locator('[data-day="2026-11-16"] .stripes i').count(), 4, 'max four stripes');
    eq(await text(page, '[data-day="2026-11-16"] .more'), '+1', 'and a count for the rest');
    eq(await text(page, '#selDay'), 'Monday 23 November', 'today selected');

    await page.locator('[data-day="2026-11-20"]').click();
    await page.waitForFunction(() => document.getElementById('selDay')?.textContent === 'Friday 20 November');
    eq(await page.locator('#dayNotes .note').count(), 2, "that day's notes");
    assert((await page.locator('#dayNotes .note').first().innerText()).includes('Gift idea'), 'newest first');

    // edit from the calendar
    await page.locator('#dayNotes .note .note-body').first().click();
    await page.locator('[data-ec="purple"]').click();
    await page.locator('#saveNote').click();
    await page.locator('[data-day="2026-11-20"] .stripes i.c-purple').waitFor();

    // Show in list jumps to that day
    await page.locator('#showInList').click();
    await page.waitForSelector('[data-day-group="2026-11-20"].flash');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
