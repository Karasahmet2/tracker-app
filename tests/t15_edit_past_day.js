// Update 3: drinks on any past day can be added, changed and deleted — and only that day changes.
const { openApp, seedDrinks, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-22T12:00:00' });
  try {
    await seedDrinks(page, [['2026-11-17T09:00', 1000], ['2026-11-17T15:00', 500], ['2026-11-18T10:00', 2000], ['2026-11-22T08:00', 330]]);
    await page.goto(url + '#/calendar/day/2026-11-17');
    await page.waitForSelector('#dayTotal');
    await page.locator('#editDay').click();
    await page.waitForSelector('#entries .entry');
    eq(await text(page, '#logTitle'), 'Log · Tue 17 Nov', 'log for that day');

    // add a forgotten drink at 20:30
    await page.locator('#addPast').click();
    await page.locator('#amt').fill('700');
    await page.locator('#timeIn').fill('20:30');
    await page.locator('#saveDrink').click();
    await page.waitForFunction(() => document.getElementById('logTotal').textContent === '2.20 L');
    eq(await page.locator('#entries .entry').first().locator('time').innerText(), '20:30', 'newest first');

    // change the 09:00 drink to 1.2 L at 08:15
    await page.locator('#entries .entry', { hasText: '09:00' }).locator('.what').click();
    await page.getByRole('dialog', { name: 'Change drink' }).waitFor();
    eq(await page.locator('#amt').inputValue(), '1000', 'shows the current amount');
    await page.locator('#amt').fill('1200');
    await page.locator('#timeIn').fill('08:15');
    await page.locator('#saveDrink').click();
    await page.waitForFunction(() => document.getElementById('logTotal').textContent === '2.40 L');
    assert((await text(page, '#entries')).includes('08:15'), 'time changed');

    // delete the 15:00 drink (goes to Trash, can be undone)
    await page.getByRole('button', { name: 'Delete 500 ml at 15:00' }).click();
    await page.waitForFunction(() => document.getElementById('logTotal').textContent === '1.90 L');
    await page.locator('.toast [data-undo]').click();
    await page.waitForFunction(() => document.getElementById('logTotal').textContent === '2.40 L');

    // a time in the future is refused for today
    await page.goto(url + '#/water/log');
    await page.waitForSelector('#addPast');
    await page.locator('#addPast').click();
    await page.locator('#timeIn').fill('18:00');
    await page.locator('#saveDrink').click();
    await page.locator('.toast span', { hasText: "hasn't happened yet" }).waitFor();
    await page.goBack();

    // other days untouched
    await page.goto(url + '#/calendar/day/2026-11-18');
    await page.waitForSelector('#dayTotal');
    eq(await text(page, '#dayTotal'), '2.00', 'the 18th is unchanged');
    await page.goto(url + '#/water');
    await page.waitForSelector('#totalNum');
    eq(await text(page, '#totalNum'), '0.33', 'today is unchanged');
    await page.goto(url + '#/calendar/day/2026-11-17');
    await page.waitForSelector('#dayTotal');
    eq(await text(page, '#dayTotal'), '2.40', 'calendar shows the edited day');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
