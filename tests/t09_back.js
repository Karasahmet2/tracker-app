// Update 1: the phone's back gesture closes sheets first, then steps back through pages.
const { openApp, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, errors, close } = await openApp();
  try {
    // Update 8: Settings is a page; the back gesture closes its Trash sheet first, then leaves Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForSelector('#setData');
    await page.locator('#openTrash').click();
    await page.getByRole('dialog', { name: 'Trash' }).waitFor();
    await page.goBack();
    await page.waitForSelector('.overlay', { state: 'detached' });
    assert(page.url().endsWith('#/settings'), 'still on Settings');
    await page.goBack();
    await page.waitForSelector('#bigWrap');
    assert(page.url().endsWith('#/water'), 'back on Today');

    await page.locator('#logLink').click();
    await page.waitForSelector('#entries');
    await page.goBack();
    await page.waitForSelector('#bigWrap');
    assert(page.url().endsWith('#/water'), 'back to Today');

    // the in-app back arrow also works when the log is opened directly
    await page.goto(page.url().replace('#/water', '#/water/log'));
    await page.reload();
    await page.waitForSelector('#entries');
    await page.getByRole('link', { name: 'Back to today' }).click();
    await page.waitForSelector('#bigWrap');

    // pull a sheet down to close it
    await page.getByRole('button', { name: 'Custom amount' }).click();
    const sheet = page.locator('.sheet');
    await sheet.waitFor();
    await page.waitForTimeout(400);                       // let it finish sliding up
    const box = await sheet.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 200, { steps: 8 });
    await page.mouse.up();
    await page.waitForSelector('.overlay', { state: 'detached' });

    await page.locator('#nav a[data-tab="running"]').click();
    await page.waitForSelector('#track');
    assert((await text(page, '.head h1')) === 'Running', 'running page');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
