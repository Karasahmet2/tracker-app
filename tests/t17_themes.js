// Update 3: themes change the colours everywhere and are remembered.
const { openApp, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp();
  try {
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const water = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--water').trim());
    eq(await bg(), 'rgb(10, 16, 32)', 'Midnight by default');
    await page.getByRole('button', { name: 'Settings' }).click();
    eq(await page.locator('[data-theme-pick]').count(), 4, 'four themes');
    await page.getByRole('button', { name: 'Daylight theme' }).click();
    eq(await bg(), 'rgb(243, 246, 250)', 'Daylight is light');
    eq(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#F3F6FA', 'phone bar colour follows');
    await page.getByRole('button', { name: 'Ocean theme' }).click();
    eq(await water(), '#1BB5A5', 'Ocean water colour');
    assert(await page.getByRole('button', { name: 'Ocean theme' }).getAttribute('aria-pressed') === 'true', 'chosen theme marked');
    await page.goBack();
    await page.reload();
    await page.waitForSelector('#cupGrid .cup');
    eq(await water(), '#1BB5A5', 'remembered after reopening');
    // the calendar and bottles use the theme colour
    await page.goto(url + '#/calendar/month');
    await page.waitForSelector('#monthGrid');
    const tab = await page.evaluate(() => getComputedStyle(document.querySelector('.zoom a.on')).backgroundColor);
    eq(tab, 'rgb(27, 181, 165)', 'calendar follows the theme');
    // no hard-coded colours left in the scripts
    const fs = require('fs'), path = require('path');
    ['water.js', 'calendar.js', 'ui.js', 'settings.js'].forEach((f) => {
      const src = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
      assert(!/#[0-9A-Fa-f]{6}/.test(src), `${f} has a hard-coded colour`);
    });
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
