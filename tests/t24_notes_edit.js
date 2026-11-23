// Update 6: edit a note's text and colour (the written time stays), delete to Trash, restore.
const { openApp, text, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, url, errors, close } = await openApp({ time: '2026-11-23T08:20:00' });
  try {
    await page.goto(url + '#/notes');
    await page.waitForSelector('#quickIn');
    await page.locator('#quickIn').fill('Treadmill felt easy at 2%.');
    await page.locator('#quickSave').click();
    await page.locator('.note').first().waitFor();

    await page.clock.setFixedTime(new Date('2026-11-23T09:02:00'));
    await page.locator('.note .note-body').first().click();
    await page.getByRole('dialog', { name: 'Edit note' }).waitFor();
    assert((await text(page, '.note-times')).includes('Mon 23 Nov · 08:20'), 'shows when written');
    await page.locator('#noteText').fill('Treadmill felt easy at 2%. Try 4% on Thursday.');
    await page.locator('[data-ec="blue"]').click();
    assert(await page.locator('#noteText.c-blue').count() === 1, 'preview colour');
    await page.locator('#saveNote').click();
    await page.locator('.note.c-blue', { hasText: 'Thursday' }).waitFor();
    const meta = await page.locator('.note .note-meta').first().innerText();
    assert(meta.includes('08:20') && meta.includes('edited 09:02'), 'keeps written time, shows edit: ' + meta);

    // undo the edit
    await page.locator('.toast [data-undo]').click();
    await page.locator('.note.c-yellow', { hasText: 'easy at 2%.' }).waitFor();
    assert(!(await page.locator('.note .note-meta').first().innerText()).includes('edited'), 'edit undone');

    // delete → Trash → restore
    await page.locator('.note .note-body').first().click();
    await page.locator('#delNote').click();
    await page.locator('#noteList .empty').waitFor();
    await page.goto(url + '#/water');
    await page.waitForSelector('#cupGrid .cup');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#openTrash').click();
    await page.locator('#trashList', { hasText: 'Treadmill felt easy' }).waitFor();
    await page.locator('[data-restore]').click();
    await page.goto(url + '#/notes');
    await page.locator('.note', { hasText: 'Treadmill felt easy' }).waitFor();
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
