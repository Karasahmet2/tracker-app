// Update 1: drinks and settings are still there after closing and reopening the app.
const { openApp, addCup, text, eq } = require('./helpers');
module.exports = async () => {
  const { page, errors, close } = await openApp();
  try {
    await addCup(page, '330 ml');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#goalIn').fill('3');
    await page.locator('#goalIn').dispatchEvent('change');
    await page.goBack();
    await page.reload();
    await page.waitForSelector('#cupGrid .cup');
    eq(await text(page, '#totalNum'), '0.33', 'drink kept');
    eq(await text(page, '#goalOf'), '/ 3 L', 'goal kept');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
