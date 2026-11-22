// Update 5: a phone on the old database (v1, before running) upgrades without losing drinks;
// the Running page fits the screen without scrolling.
const { chromium } = require('playwright');
const { startServer, eq, assert } = require('./helpers');
module.exports = async () => {
  const { server, url } = await startServer();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 851 }, serviceWorkers: 'block' });
    await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // make a v1 database by hand, as an older version of the app would have
    await page.goto(url + 'manifest.webmanifest');
    await page.evaluate(() => new Promise((res, rej) => {
      const r = indexedDB.open('tracker', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        db.createObjectStore('drinks', { keyPath: 'id' }).createIndex('ts', 'ts');
        db.createObjectStore('trash', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
      };
      r.onsuccess = () => {
        const tx = r.result.transaction(['drinks', 'settings'], 'readwrite');
        tx.objectStore('drinks').put({ id: 'old1', ts: Date.now() - 3600e3, ml: 750 });
        tx.objectStore('settings').put({ key: 'goal', value: 3000 });
        tx.oncomplete = () => { r.result.close(); res(); };
      };
      r.onerror = () => rej(r.error);
    }));
    await page.goto(url + '#/water');
    await page.waitForSelector('#cupGrid .cup');
    eq(await page.locator('#totalNum').innerText(), '0.75', 'old drink kept');
    eq(await page.locator('#goalOf').innerText(), '/ 3 L', 'old goal kept');
    const stores = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('tracker'); r.onsuccess = () => { res([r.result.version, [...r.result.objectStoreNames]]); r.result.close(); }; }));
    eq(stores[0], 2, 'database upgraded to v2');
    assert(stores[1].includes('runs'), 'runs store added');

    await page.goto(url + '#/running');
    await page.waitForSelector('#track');
    for (const [w, h] of [[393, 851], [393, 760], [393, 700], [360, 640]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, inner: innerHeight, track: document.getElementById('track').getBoundingClientRect().width }));
      assert(m.scroll <= m.inner + 1, `running ${w}×${h}: page scrolls (${m.scroll} > ${m.inner})`);
      assert(m.track >= 200, `running ${w}×${h}: track too small`);
    }
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await browser.close(); server.close(); }
};
