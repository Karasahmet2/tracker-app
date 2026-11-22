// Update 1: save a backup file, and loading it puts the data back exactly.
const fs = require('fs');
const { openApp, addCup, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, errors, close } = await openApp();
  try {
    await addCup(page, '500 ml');
    await addCup(page, '330 ml');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#openBackup').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#saveBk').click()]);
    const file = await download.path();
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    eq(data.kind, 'tracker-backup', 'backup kind');
    eq(data.drinks.length, 2, 'two drinks in the file');
    await page.goBack();
    await page.waitForSelector('.overlay', { state: 'detached' });

    await addCup(page, '1 L');
    eq(await text(page, '#totalNum'), '1.83', 'three drinks now');

    page.on('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#openBackup').click();
    await page.locator('#loadBk').setInputFiles(file);
    await page.waitForFunction(() => document.getElementById('totalNum').textContent === '0.83');

    // a wrong file is refused and nothing changes
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#openBackup').click();
    await page.locator('#loadBk').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
    await page.locator('.toast span', { hasText: "isn't a tracker backup" }).waitFor();
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
