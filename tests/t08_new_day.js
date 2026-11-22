// Update 1 (+2): the bottles empty on a new day; past days keep their drinks.
const { openApp, addCup, turnOffAsk, text, eq } = require('./helpers');
module.exports = async () => {
  const { page, errors, close } = await openApp({ time: '2026-11-21T20:00:00' });
  try {
    await turnOffAsk(page);
    for (const c of ['1 L', '1 L', '500 ml']) await addCup(page, c, { confirm: false });
    eq(await text(page, '#totalNum'), '2.50', 'yesterday reached the goal');

    await page.clock.setFixedTime(new Date('2026-11-22T08:00:00'));
    await page.reload();
    await page.waitForSelector('#cupGrid .cup');
    eq(await text(page, '#totalNum'), '0.00', 'new day starts empty');

    await page.goto(page.url().split('#')[0] + '#/calendar/day/2026-11-21');
    await page.waitForSelector('#dayTotal');
    eq(await text(page, '#dayTotal'), '2.50', 'yesterday is kept in the calendar');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
