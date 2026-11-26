// Update 7: add a drink to a past day from the calendar — cups, quick times, preview, and only that day changes.
const { openApp, seedDrinks, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-22T11:30:00' });
  try {
    await seedDrinks(page, [['2026-11-17T09:00', 2000], ['2026-11-22T08:00', 330]]);
    await page.goto(url + '#/calendar/day/2026-11-17');
    await page.waitForSelector('#dayTotal');
    eq(await text(page, '#editDay'), 'All 1 drink ›', 'link to the full list');
    await page.locator('#addDayDrink').click();
    await page.getByRole('dialog', { name: /Add a drink to Tuesday 17 November/ }).waitFor();
    eq(await text(page, '#addDayName'), 'Tuesday 17 November', 'says which day');
    eq(await page.locator('#addCups .cup').count(), 4, 'the same cups as Today');
    assert(await page.locator('[data-add-ml="500"].on').count() === 1, '500 ml picked to start');
    eq(await text(page, '#addIt'), 'Add 500 ml at 15:00', 'button says what will happen');
    assert((await text(page, '#dayPreview')).includes('2.50 L'), 'preview: 2.0 + 0.5');

    await page.locator('[data-add-ml="1000"]').click();
    await page.locator('[data-time="19:00"]').click();
    eq(await text(page, '#addIt'), 'Add 1 L at 19:00', 'updates');
    assert((await text(page, '#dayPreview')).includes('+0.50 L extra'), 'preview shows extra');
    await page.locator('#addIt').click();
    await page.waitForFunction(() => document.getElementById('dayTotal')?.textContent === '3.00');
    assert((await text(page, '.toast span')).includes('Added 1 L at 19:00 · 17 Nov'), 'toast names the day');
    eq(await page.locator('#dayList .entry').first().locator('time').innerText(), '19:00', 'listed at its time');

    // other amount
    await page.locator('#addDayDrink').click();
    await page.locator('#otherAmt').click();
    await page.locator('#amt').fill('275');
    eq(await text(page, '#addIt'), 'Add 275 ml at 15:00', 'other amount');
    assert(await page.locator('#addCups .cup.on').count() === 0, 'no cup marked while typing an amount');
    await page.locator('#addIt').click();
    await page.waitForFunction(() => document.getElementById('dayTotal')?.textContent === '3.27');

    // today: later quick times can't be picked yet, and today is unchanged by the past-day adds
    await page.goto(url + '#/calendar/day/2026-11-22');
    await page.waitForSelector('#dayTotal');
    eq(await text(page, '#dayTotal'), '0.33', 'today untouched');
    await page.locator('#addDayDrink').click();
    assert(await page.locator('[data-time="09:00"]:not([disabled])').count() === 1, 'morning is fine');
    assert(await page.locator('[data-time="12:00"][disabled]').count() === 1, 'noon is still ahead');
    eq(await page.locator('#timeIn').inputValue(), '11:30', 'starts at the current time');
    await page.locator('#addIt').click();
    await page.waitForFunction(() => document.getElementById('dayTotal')?.textContent === '0.83');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
