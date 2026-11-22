// Update 1: going past the goal fills the big bottle and spills into the bonus bottle.
const { openApp, addCup, turnOffAsk, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, errors, close } = await openApp();
  try {
    await turnOffAsk(page);
    for (const c of ['1 L', '1 L', '330 ml']) await addCup(page, c, { confirm: false });
    eq(await text(page, '#totalNum'), '2.33', 'before the goal');
    assert(!(await page.locator('#bigWrap.full').count()), 'not full yet');

    await page.getByRole('button', { name: 'Add 500 ml', exact: true }).click();
    await page.waitForSelector('.arc-svg');               // overflow stream into the bonus bottle
    await page.waitForSelector('.banner');
    assert((await text(page, '.banner b')) === 'Goal reached!', 'banner');
    await page.waitForFunction(() => !document.querySelector('#cupGrid .cup[disabled]'));
    eq(await text(page, '#totalNum'), '2.83', 'total');
    assert(await page.locator('#bigWrap.full').count() === 1, 'big bottle full');
    assert(await page.locator('#bonusCol.open').count() === 1, 'bonus open');
    eq(await text(page, '#bonusCaption'), '330 / 1000 ml', 'bonus amount');
    const h = await page.locator('#bonusFill').evaluate((el) => parseFloat(el.style.height));
    eq(h, 33, 'bonus fill height');
    eq(await text(page, '#remaining'), 'Goal reached · 113%', 'reached text');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
