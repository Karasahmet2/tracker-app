// Update 5: passing the weekly goal opens the bonus lap; runs can be edited, deleted (Trash) and undone.
const { openApp, text, eq, assert } = require('./helpers');
async function seedRuns(page, rows) {
  await page.evaluate((rows) => new Promise((res, rej) => {
    const r = indexedDB.open('tracker');
    r.onsuccess = () => {
      const tx = r.result.transaction('runs', 'readwrite');
      rows.forEach(([t, km, sec, where, incline], i) => tx.objectStore('runs').put({ id: 'run' + i, ts: new Date(t).getTime(), km, sec, where, incline }));
      tx.oncomplete = () => { r.result.close(); res(); }; tx.onerror = () => rej(tx.error);
    };
  }), rows);
  await page.reload();
}
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-22T16:00:00' });
  try {
    await page.goto(url + '#/running');
    await page.waitForSelector('#track');
    await seedRuns(page, [['2026-11-16T07:30', 5, 1630, 'outdoor', 0], ['2026-11-18T07:30', 3.2, 1170, 'treadmill', 2], ['2026-11-21T08:00', 3.2, 1145, 'treadmill', 4], ['2026-11-12T08:00', 9, 3000, 'outdoor', 0]]);
    await page.waitForSelector('#track');
    eq(await text(page, '#runTotal'), '11.4', 'last week\'s run not counted');
    eq(await page.locator('#notches circle').count(), 2, 'a marker where each earlier run ended');

    await page.locator('#runAgain').click();
    eq(await page.locator('#kmIn').inputValue(), '3.2', 'same as last fills the sheet');
    await page.locator('#kmIn').fill('5');
    await page.locator('#durIn').fill('28:40');
    await page.locator('#saveRun').click();
    await page.locator('.banner b', { hasText: 'Weekly goal reached!' }).waitFor();
    eq(await text(page, '#runTotal'), '16.4', 'total');
    assert((await text(page, '#runSub')).includes('+1.4 km bonus'), 'bonus text');
    assert(await page.locator('#track.reached').count() === 1, 'reached');
    const b = await page.locator('#trackBonus').evaluate((el) => el.style.strokeDasharray);
    assert(b.startsWith('28'), 'bonus lap 1.4 of 5 km: ' + b);

    // undo, then edit and delete through the calendar day
    await page.locator('.toast [data-undo]').click();
    await page.waitForFunction(() => document.getElementById('runTotal').textContent === '11.4');
    await page.goto(url + '#/calendar/run/day/2026-11-21');
    await page.waitForSelector('#runList');
    await page.locator('#runList [data-run] .what').click();
    await page.getByRole('dialog', { name: 'Change run' }).waitFor();
    eq(await page.locator('#incIn').inputValue(), '4', 'shows the incline');
    await page.locator('#kmIn').fill('4');
    await page.locator('#saveRun').click();
    await page.waitForFunction(() => document.querySelector('#runList .what b')?.textContent.startsWith('4.0 km'));
    await page.locator('#runList [data-run] .what').click();
    await page.locator('#delRun').click();
    await page.locator('#runList .empty').waitFor();

    // restore from the Trash
    await page.goto(url + '#/water');
    await page.waitForSelector('#cupGrid .cup');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#openTrash').click();
    await page.locator('#trashList', { hasText: '4.0 km run' }).waitFor();
    await page.locator('[data-restore]').click();
    await page.goto(url + '#/running');
    await page.waitForSelector('#track');
    eq(await text(page, '#runTotal'), '12.2', 'restored');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
