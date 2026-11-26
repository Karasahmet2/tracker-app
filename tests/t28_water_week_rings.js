// Update 7: the water month has a WEEK column — a ring toward the week's goal so far, inner ring for extra.
const { openApp, seedDrinks, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-19T12:00:00' });
  try {
    await seedDrinks(page, [
      ['2026-11-09T10:00', 2500], ['2026-11-10T10:00', 2500], ['2026-11-11T10:00', 2500], ['2026-11-12T10:00', 2500],
      ['2026-11-13T10:00', 2500], ['2026-11-14T10:00', 2500], ['2026-11-15T10:00', 3500],       // full week + 1 L extra
      ['2026-11-16T10:00', 2500], ['2026-11-17T10:00', 1250]                                    // this week so far
    ]);
    await page.goto(url + '#/calendar/month/2026-11-19');
    await page.waitForSelector('#monthGrid');
    eq(await page.locator('.mgrid.weekdays span').last().innerText(), 'WEEK', 'week column');
    eq(await page.locator('#monthGrid .wring').count(), 6, 'a ring per row');
    const full = page.locator('.wring[data-week="2026-11-09"]');
    eq(await full.locator('b').innerText(), '18.5', 'week total in litres');
    const dash = (loc) => loc.evaluate((el) => parseFloat(el.style.strokeDasharray));
    eq(await dash(full.locator('.ring:not(.bonus)')), 100, 'week at goal');
    eq(await dash(full.locator('.ring.bonus')), 14.3, 'extra: 1 L of 7 L');

    // this week: Mon–Thu counted (Thu is today) = 10 L goal so far
    const now = page.locator('.wring[data-week="2026-11-16"]');
    eq(await now.locator('b').innerText(), '3.8', 'this week so far');
    eq(await dash(now.locator('.ring:not(.bonus)')), 37.5, '3.75 of 10 L');
    assert(await now.locator('.ring.bonus').count() === 0, 'no extra yet');
    assert(await page.locator('.wring.not-yet[data-week="2026-11-30"]').count() === 1, 'future week faded');
    assert((await full.getAttribute('aria-label')).includes('18.50 of 17.50 litres'), 'read out');

    await full.click();
    await page.waitForSelector('#weekGrid');
    eq(await text(page, '#periodLabel'), '9 – 15 Nov', 'ring opens its week');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
