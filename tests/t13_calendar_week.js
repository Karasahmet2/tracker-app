// Update 2: the Week view shows 7 day cards (4 + 3) with a bonus bottle each, and a summary card.
const { openApp, seedDrinks, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-22T12:00:00' });
  try {
    await seedDrinks(page, [
      ['2026-11-16T10:00', 2500],                      // Mon at goal
      ['2026-11-17T10:00', 3320],                      // Tue +0.82
      ['2026-11-18T10:00', 1250],                      // Wed half
      ['2026-11-22T09:00', 1000]                       // Sun (today) so far
    ]);
    await page.goto(url + '#/calendar/week/2026-11-19');
    await page.waitForSelector('#weekGrid');
    eq(await text(page, '#periodLabel'), '16 – 22 Nov', 'Monday to Sunday');
    eq(await page.locator('#weekGrid .wcard').count(), 7, 'seven days');
    const cols = await page.locator('#weekGrid > *').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    eq(new Set(cols.slice(0, 4)).size, 1, 'four on the first row');
    assert(cols[4] > cols[0] && new Set(cols.slice(4)).size === 1, 'three cards + summary on the second row');

    const tue = page.locator('.wcard[data-day="2026-11-17"]');
    assert(await tue.evaluate((el) => el.classList.contains('has-extra')), 'Tuesday has extra');
    eq(await tue.locator('.wbonus .wfill').evaluate((el) => parseFloat(el.style.height)), 82, 'bonus bottle 82% full');
    assert((await tue.locator('.wamt').innerText()).includes('+0.8'), 'extra label');
    assert(!(await page.locator('.wcard[data-day="2026-11-18"] .wbonus .wfill').count()), 'no extra on Wednesday');
    eq(await page.locator('.wcard[data-day="2026-11-18"] .wbig .wfill').evaluate((el) => parseFloat(el.style.height)), 50, 'Wednesday half');
    assert(await page.locator('.wcard.today[data-day="2026-11-22"]').count() === 1, 'today outlined');

    const sum = await text(page, '.wsum');
    assert(sum.includes('1.15 L'), 'average over 7 days: ' + sum);
    assert(sum.includes('2 of 7'), 'days at goal');
    assert(sum.includes('+0.82 L'), 'total extra');
    eq(await text(page, '.period-right'), '8.07 L', 'week total');

    await page.getByRole('link', { name: 'Previous week' }).click();
    await page.waitForFunction(() => document.getElementById('periodLabel')?.textContent === '9 – 15 Nov');
    await page.goBack();
    await page.waitForFunction(() => document.getElementById('periodLabel')?.textContent === '16 – 22 Nov');
    await tue.click();
    await page.waitForSelector('#dayTotal');
    eq(await text(page, '#dayTotal'), '3.32', 'card opens the day');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
