// Update 6: search finds notes by words (any order, any case) and highlights them; colour filters.
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
        [['2026-11-23T16:42', 'yellow', 'Idea: make the water bottle wobble when I shake the phone.'],
         ['2026-11-23T11:05', 'plain', 'Buy a 1 L bottle for the office.'],
         ['2026-11-22T22:10', 'purple', 'Finish chapter 6 before the weekend.'],
         ['2026-11-20T09:12', 'plain', 'Orange for running, blue for WATER — keep notes yellow.'],
         ['2026-10-02T09:12', 'green', 'Old idea about <b>water</b> & tea']]
          .forEach(([t, c, x], i) => tx.objectStore('notes').put({ id: 's' + i, ts: new Date(t).getTime(), edited: null, text: x, color: c }));
        tx.oncomplete = res;
      };
    }));
    await page.reload();
    await page.waitForSelector('.note');
    eq(await page.locator('.note').count(), 5, 'all notes');

    await page.locator('#searchBtn').click();
    await page.locator('#searchIn').fill('water');
    eq(await page.locator('.note').count(), 3, 'three mention water (any case)');
    eq(await text(page, '.result-count'), '3 notes found', 'count');
    eq(await page.locator('.note mark').count(), 3, 'highlighted');
    assert((await page.locator('.note', { hasText: 'Old idea' }).innerHTML()).includes('&lt;b&gt;'), 'note text is never run as HTML');

    await page.locator('#searchIn').fill('bottle WATER');
    eq(await page.locator('.note').count(), 1, 'all words must match, any order');
    await page.locator('#searchIn').fill('zebra');
    assert((await text(page, '#noteList')).includes('No notes match'), 'nothing found');

    // search stays when coming back, and Done clears it
    await page.locator('#searchIn').fill('water');
    await page.goto(url + '#/water');
    await page.waitForSelector('#cupGrid');
    await page.goto(url + '#/notes');
    await page.waitForSelector('#searchIn');
    eq(await page.locator('#searchIn').inputValue(), 'water', 'search kept');
    await page.locator('#searchClose').click();
    eq(await page.locator('.note').count(), 5, 'Done shows all again');

    // colour filter
    await page.locator('[data-filter="plain"]').click();
    eq(await page.locator('.note').count(), 2, 'only plain');
    await page.locator('[data-filter="plain"]').click();
    eq(await page.locator('.note').count(), 5, 'tap again for all');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
