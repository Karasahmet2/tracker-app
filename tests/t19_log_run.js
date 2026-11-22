// Update 5: log a treadmill run with incline; pace, speed and climbed are worked out; the track fills.
const { openApp, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-22T16:00:00' });
  try {
    await page.goto(url + '#/running');
    await page.waitForSelector('#track');
    eq(await text(page, '#runTotal'), '0.0', 'empty week');
    eq(await text(page, '#runGoalOf'), '/ 15 km', 'default weekly goal');
    eq(await text(page, '#runSub'), 'No runs yet this week', 'nothing yet');
    assert(await page.locator('#runAgain.hidden').count() === 1, 'no "same as last" before the first run');

    await page.locator('#logRun').click();
    await page.getByRole('dialog', { name: 'Log a run' }).waitFor();
    assert(await page.locator('#inclineBox.hidden').count() === 1, 'incline hidden for outdoor');
    await page.locator('[data-where="treadmill"]').click();
    assert(await page.locator('#inclineBox:not(.hidden)').count() === 1, 'incline shown for treadmill');
    await page.locator('[data-km="5"]').click();
    await page.locator('#durIn').fill('28:40');
    await page.locator('[data-inc="2"]').click();
    eq(await text(page, '#paceOut'), '5:44 /km', 'pace');
    eq(await text(page, '#speedOut'), '10.5 km/h', 'speed');
    eq(await text(page, '#climbOut'), '≈ 100 m', 'climbed = 5 km × 2%');
    await page.locator('#incIn').fill('3.5');
    eq(await text(page, '#climbOut'), '≈ 175 m', 'typed incline');
    await page.locator('#saveRun').click();
    await page.waitForFunction(() => document.getElementById('runTotal').textContent === '5.0');
    assert((await text(page, '.toast span')).includes('Run saved · 5.0 km'), 'toast');
    eq(await text(page, '#runSub'), '10.0 km to go · 1 run', 'to go');
    const dash = await page.locator('#trackMain').evaluate((el) => el.style.strokeDasharray);
    assert(dash.startsWith('33.3'), 'track a third full: ' + dash);
    assert((await text(page, '#runAgain')).includes('5.0 km · treadmill 3.5%'), 'same as last');

    // validation
    await page.locator('#logRun').click();
    await page.locator('#durIn').fill('');
    await page.locator('#saveRun').click();
    await page.locator('.toast span', { hasText: 'Enter the time' }).waitFor();
    await page.locator('#durIn').fill('1:02:30');
    await page.locator('#kmIn').fill('10');
    eq(await text(page, '#paceOut'), '6:15 /km', 'h:mm:ss works');
    await page.locator('#saveRun').click();
    await page.waitForFunction(() => document.getElementById('runTotal').textContent === '15.0');

    // persists
    await page.reload();
    await page.waitForSelector('#track');
    eq(await text(page, '#runTotal'), '15.0', 'kept after reload');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
