// Update 3: changing the daily goal counts from today; past days keep the goal they had.
const { openApp, seedDrinks, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-20T12:00:00' });
  try {
    await seedDrinks(page, [['2026-11-18T10:00', 2500], ['2026-11-19T10:00', 2800], ['2026-11-20T09:00', 2500]]);
    // raise the goal to 3 L on the 20th
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#goalIn').fill('3');
    await page.locator('#goalIn').dispatchEvent('change');
    await page.goBack();
    await page.waitForSelector('.overlay', { state: 'detached' });
    eq(await text(page, '#goalOf'), '/ 3 L', 'today uses the new goal');
    eq(await text(page, '#remaining'), '500 ml to go · 83%', 'today no longer full');

    // next day, check the calendar
    await page.clock.setFixedTime(new Date('2026-11-21T09:00:00'));
    await page.goto(url + '#/calendar/day/2026-11-18');
    await page.waitForSelector('#dayTotal');
    assert((await text(page, '#daySub')).includes('Goal reached'), 'the 18th still reached its 2.5 L goal');
    await page.goto(url + '#/calendar/day/2026-11-19');
    await page.waitForSelector('#dayTotal');
    assert((await text(page, '#daySub')).includes('+300 ml extra'), 'the 19th keeps its 300 ml extra');
    await page.goto(url + '#/calendar/month/2026-11-21');
    await page.waitForSelector('#monthGrid');
    assert(await page.locator('[data-day="2026-11-18"].full').count() === 1, 'month: 18th full');
    assert(await page.locator('[data-day="2026-11-20"].full').count() === 0, 'month: 20th not full under 3 L');
    eq(await page.locator('[data-day="2026-11-20"] .mfill').evaluate((el) => Math.round(parseFloat(el.style.height))), 83, '20th at 83%');

    // editing today's log doesn't move past days
    await page.goto(url + '#/water');
    await page.waitForSelector('#cupGrid .cup');
    await page.getByRole('button', { name: 'Add 1 L', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, add it' }).click();
    await page.waitForFunction(() => document.getElementById('totalNum').textContent === '1.00');
    await page.goto(url + '#/calendar/week/2026-11-18');
    await page.waitForSelector('#weekGrid');
    assert((await text(page, '.wsum')).includes('2 of 6'), 'week: only the 18th and 19th at goal: ' + await text(page, '.wsum'));
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
