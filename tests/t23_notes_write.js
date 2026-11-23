// Update 6: write quick notes — Save or Enter, newest first, grouped by day, colour remembered.
const { openApp, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-23T09:15:00' });
  try {
    await page.locator('#nav a[data-tab="notes"]').click();
    await page.waitForSelector('#quickIn');
    assert((await text(page, '#noteList')).includes('No notes yet'), 'empty state');
    assert(await page.locator('[data-qc="yellow"].on').count() === 1, 'yellow by default');

    await page.locator('#quickIn').fill('Buy a 1 L bottle for the office');
    await page.locator('#quickSave').click();
    await page.locator('.note', { hasText: 'Buy a 1 L bottle' }).waitFor();
    eq(await page.locator('#quickIn').inputValue(), '', 'box clears');
    assert(await page.locator('.note.c-yellow').count() === 1, 'saved in yellow');

    // pick green, then Enter saves (Shift+Enter is a new line)
    await page.locator('[data-qc="green"]').click();
    await page.clock.setFixedTime(new Date('2026-11-23T10:40:00'));
    await page.locator('#quickIn').click();
    await page.keyboard.type('Treadmill felt easy at 2%.');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Try 4% on Thursday.');
    await page.keyboard.press('Enter');
    await page.locator('.note', { hasText: 'Try 4%' }).waitFor();
    const first = page.locator('.note').first();
    assert((await first.innerText()).includes('Treadmill felt easy'), 'newest on top');
    assert((await first.locator('.note-text').innerText()).includes('2%.\nTry 4%'), 'line break kept');
    assert(await first.evaluate((el) => el.classList.contains('c-green')), 'green');
    assert((await first.locator('.note-meta').innerText()).includes('10:40'), 'time it was written');

    // empty text isn't saved; colour is remembered after reopening
    await page.locator('#quickSave').click();
    eq(await page.locator('.note').count(), 2, 'blank not saved');
    await page.reload();
    await page.waitForSelector('#quickIn');
    assert(await page.locator('[data-qc="green"].on').count() === 1, 'last colour remembered');

    // next day: grouping
    await page.clock.setFixedTime(new Date('2026-11-24T08:00:00'));
    await page.reload();
    await page.waitForSelector('.note-day');
    await page.locator('#quickIn').fill('New day thought');
    await page.locator('#quickSave').click();
    await page.locator('.note', { hasText: 'New day thought' }).waitFor();
    const heads = await page.locator('.note-day h2').allInnerTexts();
    eq(heads.join('|').toUpperCase(), 'TODAY|YESTERDAY', 'grouped by day');

    // undo the last save
    await page.locator('.toast [data-undo]').click();
    await page.waitForFunction(() => document.querySelectorAll('.note').length === 2);
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
