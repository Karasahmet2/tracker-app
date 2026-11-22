// Update 1: Undo after adding; deleting in the log goes to Trash and can be restored.
const { openApp, addCup, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, errors, close } = await openApp();
  try {
    await addCup(page, '500 ml');
    await page.locator('.toast [data-undo]').click();
    await page.waitForFunction(() => document.getElementById('totalNum').textContent === '0.00');
    // undoing an add removes it for good (it was a mistake, not a deletion)

    await addCup(page, '200 ml');
    await addCup(page, '330 ml');
    await page.locator('#logLink').click();
    await page.waitForSelector('#entries .entry');
    eq(await page.locator('#entries .entry').count(), 2, 'two drinks in the log');
    eq(await text(page, '#logTotal'), '0.53 L', 'log total');
    await page.getByRole('button', { name: /Delete 330 ml/ }).click();
    await page.waitForFunction(() => document.querySelectorAll('#entries .entry').length === 1);
    assert((await text(page, '.toast span')).startsWith('Deleted 330 ml'), 'delete toast');

    // back to Today, then Settings → Trash → Restore
    await page.getByRole('link', { name: 'Back to today' }).click();
    await page.waitForSelector('#bigWrap');
    eq(await text(page, '#totalNum'), '0.20', 'deleted drink gone');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#openTrash').click();
    await page.waitForSelector('[data-restore]');
    eq(await page.locator('[data-restore]').count(), 1, 'only the deleted drink is in Trash');
    assert((await text(page, '#trashList')).includes('30 days left'), 'kept 30 days');
    await page.locator('[data-restore]').click();
    await page.waitForFunction(() => document.getElementById('totalNum').textContent === '0.53');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
