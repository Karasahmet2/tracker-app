// Update 1: each drink grows a branch on the 24-hour line at its time, sized by the amount.
const { openApp, addCup, turnOffAsk, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, errors, close } = await openApp({ time: '2026-11-22T14:00:00' });
  try {
    await turnOffAsk(page);
    await addCup(page, '500 ml', { confirm: false });
    const b = page.locator('#timeline .branch');
    eq(await b.count(), 1, 'one branch');
    eq(await b.evaluate((el) => el.style.top), '178.5px', '14:00 is 14/24 down the line');
    eq(await b.locator('.twig').evaluate((el) => el.style.width), '18px', '500 ml twig');
    eq(await page.locator('#timeline .now-dot').evaluate((el) => el.style.top), '178.5px', 'now marker');

    await addCup(page, '1 L', { confirm: false });
    await addCup(page, '1 L', { confirm: false });   // this one passes the goal
    await addCup(page, '200 ml', { confirm: false }); // bonus drink
    const colors = await page.locator('#timeline .twig').evaluateAll((els) => els.map((e) => e.style.background));
    eq(colors[0], 'var(--water)', 'main drinks are blue');
    eq(colors[3], 'var(--bonus)', 'drinks after the goal are cyan');
    eq(await page.locator('#timeline .twig').nth(1).evaluate((el) => el.style.width), '36px', '1 L twig');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
