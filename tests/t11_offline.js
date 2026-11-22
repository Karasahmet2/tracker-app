// Update 1: the version numbers match, and with the service worker on the app opens offline.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { ROOT, eq, assert } = require('./helpers');
module.exports = async () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/VERSION = '([^']+)'/)[1];
  const app = fs.readFileSync(path.join(ROOT, 'js/version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
  eq(sw, app, 'sw.js and js/version.js have the same version');

  // every file the service worker saves must exist
  const files = [...fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  files.forEach((f) => assert(fs.existsSync(path.join(ROOT, f)), `sw.js lists a missing file: ${f}`));
  const js = fs.readdirSync(path.join(ROOT, 'js')).map((f) => 'js/' + f);
  js.forEach((f) => assert(files.includes(f), `sw.js forgets ${f}`));

  const { startServer } = require('./server');
  const { server, url } = await startServer();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 851 } });
    await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForSelector('#cupGrid .cup');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('#cupGrid .cup');
  } finally { await browser.close(); server.close(); }
};
