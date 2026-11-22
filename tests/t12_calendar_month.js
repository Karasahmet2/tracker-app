// Update 2: the Month view fills each day like the bottle, with an extra layer past the goal.
const { openApp, seedDrinks, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-22T12:00:00' });
  try {
    await seedDrinks(page, [
      ['2026-11-10T09:00', 1000], ['2026-11-10T15:00', 250],          // 1.25 L = half
      ['2026-11-17T09:00', 2000], ['2026-11-17T18:00', 1320],         // 3.32 L = full + 820 extra
      ['2026-10-30T10:00', 2500]                                       // other month, shown faded
    ]);
    await page.locator('#nav a[data-tab="calendar"]').click();
    await page.waitForSelector('#monthGrid');
    eq(await text(page, '#periodLabel'), 'November 2026', 'opens on this month');
    eq(await page.locator('#monthGrid .mcell').count(), 42, 'six weeks (1 Nov is a Sunday), Monday first');
    eq(await page.locator('#monthGrid .mcell').first().getAttribute('data-day'), '2026-10-26', 'starts on Monday 26 Oct');

    const half = page.locator('[data-day="2026-11-10"] .mfill');
    eq(await half.evaluate((el) => parseFloat(el.style.height)), 50, 'half full');
    assert(!(await page.locator('[data-day="2026-11-10"] .mextra').count()), 'no extra layer');

    const full = page.locator('[data-day="2026-11-17"]');
    eq(await full.locator('.mfill').evaluate((el) => parseFloat(el.style.height)), 100, 'full');
    eq(await full.locator('.mextra').evaluate((el) => parseFloat(el.style.height)), 82, 'extra layer is 820 of 1000');
    assert(await full.evaluate((el) => el.classList.contains('full')), 'marked full');
    const numBox = await full.locator('.mnum').boundingBox(), cellBox = await full.boundingBox();
    assert(numBox.x > cellBox.x + cellBox.width / 2, 'date sits in the top-right');

    assert(await page.locator('[data-day="2026-11-22"].today').count() === 1, 'today outlined');
    assert(await page.locator('span.mcell.future[data-day="2026-11-23"]').count() === 1, 'future days are not links');
    assert(await page.locator('.period-nav .disabled').count() === 1, "can't go past this month");

    await page.getByRole('link', { name: 'Previous month' }).click();
    await page.waitForFunction(() => document.getElementById('periodLabel')?.textContent === 'October 2026');
    eq(await page.locator('[data-day="2026-10-30"] .mfill').evaluate((el) => parseFloat(el.style.height)), 100, 'October data');

    await page.goto(url + '#/calendar/month/2026-11-01');
    await page.waitForSelector('#monthGrid');
    await page.locator('[data-day="2026-11-17"]').click();
    await page.waitForSelector('#dayTotal');
    eq(await text(page, '#dayTotal'), '3.32', 'tapping a day opens it');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
