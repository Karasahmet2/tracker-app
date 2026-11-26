// Update 2: the Day view shows that day's bottles, 24-hour line and drinks; Day/Week/Month and pinch switch zoom.
const { openApp, seedDrinks, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-22T12:00:00' });
  try {
    await seedDrinks(page, [
      ['2026-11-17T07:40', 330], ['2026-11-17T09:15', 500], ['2026-11-17T11:30', 330], ['2026-11-17T13:05', 500],
      ['2026-11-17T15:20', 500], ['2026-11-17T16:45', 330], ['2026-11-17T18:30', 500], ['2026-11-17T20:10', 330]
    ]);
    await page.goto(url + '#/calendar/day/2026-11-17');
    await page.waitForSelector('#dayTotal');
    eq(await text(page, '#periodLabel'), 'Tue 17 Nov', 'day label');
    eq(await text(page, '#dayTotal'), '3.32', 'total');
    assert((await text(page, '#daySub')).includes('Goal reached at 18:30'), 'when the goal was reached');
    assert((await text(page, '#daySub')).includes('+820 ml extra'), 'extra');
    eq(await page.locator('#dayList .entry').count(), 8, 'every drink listed');
    eq(await page.locator('.day-stage .branch').count(), 8, 'eight twigs on the 24-hour line');
    eq(await page.locator('.day-stage .now-dot').count(), 0, 'no "now" dot on a past day');
    eq(await page.locator('.day-stage .twig').last().evaluate((el) => el.style.background), 'var(--bonus)', 'last drink is extra');
    assert(await page.locator('.day-stage .bonus-col.open').count() === 1, 'bonus bottle open');

    // Day → Week → Month with the switch, keeping the date
    await page.locator('.zoom a[data-zoom="week"]').click();
    await page.waitForSelector('#weekGrid');
    eq(await text(page, '#periodLabel'), '16 – 22 Nov', 'week of that day');
    await page.locator('.zoom a[data-zoom="month"]').click();
    await page.waitForSelector('#monthGrid');

    // pinch out (fingers apart) zooms in: month → week
    const cdp = await page.context().newCDPSession(page);
    const pinch = async (from, to) => {
      const y = 400, cx = 196;
      const pts = (d) => [{ x: cx - d, y }, { x: cx + d, y }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(from) });
      for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(from + (to - from) * i / 5) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await pinch(40, 120);
    await page.waitForSelector('#weekGrid');
    await pinch(120, 40);                                   // fingers together zooms out
    await page.waitForSelector('#monthGrid');

    // the calendar never opens a future day
    await page.goto(url + '#/calendar/day/2030-01-01');
    await page.waitForSelector('#dayTotal');
    eq(await text(page, '#periodLabel'), 'Sun 22 Nov', 'falls back to today');
    assert(await page.locator('#editDay[href="#/water/log"]').count() === 1, 'today links to the log');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
