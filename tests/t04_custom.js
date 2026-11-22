// Update 1: custom amount with −50/+50, recent amounts, and "Save as a cup button".
const { openApp, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, errors, close } = await openApp();
  try {
    await page.getByRole('button', { name: 'Custom amount' }).click();
    eq(await page.locator('#amt').inputValue(), '250', 'starts at 250');
    await page.getByRole('button', { name: 'Increase by 50 ml' }).click();
    await page.getByRole('button', { name: 'Increase by 50 ml' }).click();
    await page.getByRole('button', { name: 'Decrease by 50 ml' }).click();
    eq(await text(page, '#addCustom'), 'Add 300 ml', 'button follows the amount');
    await page.locator('#saveCup').check();
    await page.locator('#addCustom').click();
    await page.waitForFunction(() => document.getElementById('totalNum').textContent === '0.30');
    eq(await text(page, '#totalNum'), '0.30', 'custom added without asking');
    const cups = await page.locator('#cupGrid .cup span').allInnerTexts();
    eq(cups.join(','), '200 ml,300 ml,330 ml,500 ml,1 L', 'saved as a cup, in order');

    await page.getByRole('button', { name: 'Custom amount' }).click();
    eq(await page.locator('#amt').inputValue(), '300', 'remembers the last amount');
    assert(await page.locator('[data-pick="300"]').count() === 1, 'recent pill');
    await page.locator('#amt').fill('5000');
    eq(await text(page, '#addCustom'), 'Add 3 L', 'caps at 3 L');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
