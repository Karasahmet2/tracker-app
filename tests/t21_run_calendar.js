// Update 5: the calendar switches between Water and Running; running Month/Week/Day show distance and incline.
const { openApp, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-22T16:00:00' });
  try {
    await page.evaluate(() => new Promise((res) => {
      const r = indexedDB.open('tracker');
      r.onsuccess = () => {
        const tx = r.result.transaction('runs', 'readwrite');
        [['2026-11-16T07:30', 6, 1800, 'outdoor', 0], ['2026-11-18T07:30', 3, 1100, 'treadmill', 2], ['2026-11-21T08:00', 9, 3000, 'outdoor', 0], ['2026-11-04T08:00', 5, 1600, 'treadmill', 4]]
          .forEach(([t, km, sec, where, incline], i) => tx.objectStore('runs').put({ id: 'c' + i, ts: new Date(t).getTime(), km, sec, where, incline }));
        tx.oncomplete = res;
      };
    }));
    await page.goto(url + '#/running');
    await page.reload();
    await page.waitForSelector('#track');
    // the Calendar tab follows the habit you were looking at
    await page.locator('#nav a[data-tab="calendar"]').click();
    await page.waitForSelector('#monthGrid');
    assert(page.url().includes('#/calendar/run'), 'opens the running calendar');
    eq(await text(page, '.period-right'), '23.0 km · 4 runs', 'month total');
    const cell = page.locator('[data-day="2026-11-16"]');
    eq(await cell.locator('.rfill').evaluate((el) => parseFloat(el.style.height)), 100, '6 km fills the day (15 ÷ 2.5)');
    assert(await page.locator('[data-day="2026-11-04"] .rslope').count() === 1, 'treadmill mark');
    eq(await page.locator('.wring').count(), 6, 'a week ring per row');
    const ring = page.locator('.wring[data-week="2026-11-16"]');
    assert((await ring.innerText()).includes('18'), 'week ring total');
    assert(await ring.locator('.ring.bonus').count() === 1, 'week past goal shows the bonus ring');

    await ring.click();
    await page.waitForSelector('#weekGrid');
    eq(await text(page, '.period-right'), '18.0 / 15 km', 'week total');
    assert((await text(page, '.rsum')).includes('+3.0 km'), 'bonus in the summary');
    assert((await text(page, '.rcard[data-day="2026-11-18"]')).includes('2%'), 'incline on the card');
    assert((await text(page, '.rcard[data-day="2026-11-17"]')).includes('Rest'), 'rest day');

    // switch habit keeps the zoom and date
    await page.locator('.habit-switch [data-habit="water"]').click();
    await page.waitForFunction(() => location.hash.startsWith('#/calendar/week/'));
    await page.locator('.habit-switch [data-habit="run"]').click();
    await page.waitForFunction(() => location.hash.startsWith('#/calendar/run/week/'));

    // add a run to a past day from the Day view
    await page.goto(url + '#/calendar/run/day/2026-11-19');
    await page.waitForSelector('#runList .empty');
    await page.locator('#addRunDay').click();
    eq(await page.locator('#runDate').inputValue(), '2026-11-19', 'date preset to that day');
    await page.locator('#kmIn').fill('4.2');
    await page.locator('#durIn').fill('25');
    await page.locator('#saveRun').click();
    await page.waitForFunction(() => document.querySelector('#runList .what b')?.textContent.startsWith('4.2 km'));
    assert((await text(page, '#runList')).includes('5:57 /km'), 'pace from minutes only (25 min ÷ 4.2 km)');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
