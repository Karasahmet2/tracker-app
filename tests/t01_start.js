// Update 1 (+2): the app opens on Today with an empty bottle and the four cups.
const { openApp, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, errors, close } = await openApp();
  try {
    eq(await text(page, '#totalNum'), '0.00', 'starts empty');
    eq(await text(page, '#goalOf'), '/ 2.5 L', 'default goal');
    const cups = await page.locator('#cupGrid .cup span').allInnerTexts();
    eq(cups.join(','), '200 ml,330 ml,500 ml,1 L', 'default cups');
    assert(!(await page.locator('text=/streak/i').count()), 'no streak anywhere (removed in Update 2)');
    eq(await text(page, '#bonusCaption'), 'Unlocks at 2.5 L', 'bonus locked');
    assert(await page.locator('#nav a[data-tab="water"].active').count() === 1, 'Water tab active');
    assert(await page.locator('#timeline .now-dot').count() === 1, 'now marker on the 24-hour line');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
