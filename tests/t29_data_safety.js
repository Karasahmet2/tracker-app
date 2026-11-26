// Update 7: persistent storage, a weekly backup reminder, a restore offer on an empty start,
// and a newer version never gets stuck behind an older open copy.
const { openApp, seedDrinks, text, eq, assert } = require('./helpers');
module.exports = async () => {
  // empty start: offer to restore (reminders on for this test)
  let app = await openApp({ time: '2026-11-20T10:00:00', quietOff: true });
  try {
    const { page } = app;
    await page.locator('.toast', { hasText: 'restore a backup' }).waitFor();
    await page.locator('.toast [data-undo]').click();
    await page.getByRole('dialog', { name: 'Backup' }).waitFor();
    await page.goBack();
    // with data and no backup yet: the dot shows, and a reminder appears once
    await seedDrinks(page, [['2026-11-20T09:00', 500]]);
    await page.waitForSelector('#backupDot:not(.hidden)');
    await page.locator('.toast', { hasText: 'Time for a backup' }).waitFor();
    // saving clears it
    await page.locator('#backupBtn').click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#saveBk').click()]);
    assert((await dl.suggestedFilename()).startsWith('tracker-backup-2026-11-20'), 'file saved');
    await page.waitForSelector('#backupDot.hidden', { state: 'attached' });
    await page.goBack();
    await page.getByRole('button', { name: 'Settings' }).click();
    assert((await text(page, '#openBackup')).includes('Last: Today'), 'settings shows the last backup');
    assert((await text(page, '#safetyBox')).includes('127.0.0.1'), 'explains where the data lives');
    await page.locator('#persistState').filter({ hasNotText: 'Checking' }).waitFor();
    // a week later the dot comes back
    await page.goBack();
    await page.clock.setFixedTime(new Date('2026-11-28T10:00:00'));
    await page.reload();
    await page.waitForSelector('#backupDot:not(.hidden)');
    eq(app.errors.length, 0, 'no errors: ' + app.errors.join(' | '));
  } finally { await app.close(); }

  // two copies: an older open copy steps aside when a newer version upgrades the data
  app = await openApp();
  try {
    const { page, context, url } = app;
    await page.waitForSelector('#cupGrid .cup');
    const other = await context.newPage();
    await other.goto(url + 'manifest.webmanifest');
    const result = await other.evaluate(() => new Promise((res) => {
      const r = indexedDB.open('tracker', 50);
      const t = setTimeout(() => res('stuck'), 4000);
      r.onsuccess = () => { clearTimeout(t); r.result.close(); res('opened'); };
      r.onerror = () => { clearTimeout(t); res('error'); };
    }));
    eq(result, 'opened', 'the newer version got through');
  } finally { await app.close(); }
};
