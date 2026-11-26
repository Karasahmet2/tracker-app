// Update 8: Settings is a page in boxes (Your data, General, Water, Running, Notes, About),
// reachable from every tab; start page and new cups; the tabs stay pinned when a page is long.
const { openApp, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-26T14:00:00' });
  try {
    // the gear is on every tab
    for (const [hash, sel] of [['#/running', '#runSettings'], ['#/notes', '#notesSettings'], ['#/calendar', '.head a[href="#/settings"]']]) {
      await page.goto(url + hash);
      await page.locator(sel).click();
      await page.waitForSelector('#setData');
    }
    const boxes = await page.locator('.set-box h2').allInnerTexts();
    eq(boxes.join(' | '), 'Your data | General | Water | Running | Notes | About', 'the boxes, in order');
    assert((await text(page, '#appVersion')).startsWith('tracker-v'), 'version');
    assert(await page.locator('.backup-card').count() === 1, 'backup card in Your data');

    // add a cup, then it's on the Today page
    await page.locator('#addCup').click();
    await page.locator('#cupAmt').fill('750');
    await page.locator('#saveCupBtn').click();
    await page.locator('#cupPills [data-rm="750"]').waitFor();
    // note colour and start page
    await page.locator('[data-nc="green"]').click();
    await page.locator('#noteColorPick [data-nc="green"].on').waitFor();
    await page.locator('#startIn').selectOption('notes');
    await page.waitForTimeout(200);
    await page.goto(url);                                    // no address → start page
    await page.waitForSelector('#quickIn');
    assert(page.url().endsWith('#/notes'), 'opens on Notes');
    assert(await page.locator('[data-qc="green"].on').count() === 1, 'new notes start green');
    await page.goto(url + '#/water');
    await page.waitForSelector('#cupGrid');
    assert(await page.locator('#cupGrid [data-ml="750"]').count() === 1, 'the new cup is on Today');

    // switch toggle
    await page.goto(url + '#/settings');
    await page.locator('#askIn').uncheck();
    await page.goto(url + '#/water');
    await page.getByRole('button', { name: 'Add 330 ml', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('totalNum').textContent === '0.33');

    // long notes: the page scrolls, the tabs stay where they are
    await page.evaluate(async () => {
      const m = await import('/js/state.js');
      for (let i = 0; i < 6; i++) await m.addNote('A long thought that goes on and on. '.repeat(12));
    });
    await page.goto(url + '#/calendar/notes');
    await page.waitForSelector('#dayNotes .note');
    const before = await page.locator('#nav').boundingBox();
    const tall = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight);
    assert(tall, 'the page is longer than the screen');
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(200);
    const after = await page.locator('#nav').boundingBox();
    const vh = await page.evaluate(() => innerHeight);
    eq(Math.round(after.y), Math.round(before.y), 'tabs did not move');
    eq(Math.round(after.y + after.height), vh, 'tabs sit on the bottom edge');
    const last = await page.locator('#dayNotes .note').last().boundingBox();
    assert(last.y + last.height <= after.y + 1, 'the last note scrolls clear of the tabs');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
