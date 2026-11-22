// Update 1: a cup asks "Add 330 ml?" first. Cancel adds nothing; Yes pours and adds.
const { openApp, addCup, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, errors, close } = await openApp();
  try {
    await page.getByRole('button', { name: 'Add 330 ml', exact: true }).click();
    await page.getByRole('dialog', { name: 'Confirm drink' }).waitFor();
    assert((await text(page, '.sheet h2')) === 'Add 330 ml?', 'asks with the amount');
    assert((await text(page, '.confirm-body p')).includes('0.33 of 2.5 L'), 'says where you will be');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.waitForSelector('.overlay', { state: 'detached' });
    eq(await text(page, '#totalNum'), '0.00', 'cancel adds nothing');

    await page.getByRole('button', { name: 'Add 330 ml', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, add it' }).click();
    await page.waitForSelector('.pour-cup');              // pour animation plays
    assert(await page.locator('#cupGrid .cup[disabled]').count() === 4, 'cups pause during the pour');
    await page.waitForFunction(() => !document.querySelector('#cupGrid .cup[disabled]'));
    eq(await text(page, '#totalNum'), '0.33', 'added');
    eq(await text(page, '#remaining'), '2170 ml to go · 13%', 'remaining');
    assert((await text(page, '.toast span')) === 'Added 330 ml', 'toast');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
