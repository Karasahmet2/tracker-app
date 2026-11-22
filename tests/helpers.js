// Shared test tools: a tiny web server for the app folder and a phone-sized browser.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

// A Redmi-sized phone. Fonts from Google are blocked so tests don't need the internet.
async function openApp({ time } = {}) {
  const { server, url } = await startServer();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 393, height: 851 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true,
    serviceWorkers: 'block', acceptDownloads: true
  });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  if (time) await page.clock.setFixedTime(new Date(time));
  await page.goto(url);
  await page.waitForSelector('#cupGrid .cup');
  const close = async () => { await browser.close(); server.close(); };
  return { page, url, errors, close, browser, context };
}

// Tap a cup and say yes (or not) in the "Add …?" sheet, then wait for the pour to finish.
async function addCup(page, label, { confirm = true } = {}) {
  await page.getByRole('button', { name: `Add ${label}`, exact: true }).click();
  if (confirm) {
    await page.getByRole('button', { name: 'Yes, add it' }).click();
  }
  await page.waitForFunction(() => !document.querySelector('#cupGrid .cup[disabled]'));
  await page.waitForTimeout(150);
}

async function turnOffAsk(page) {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('#askIn').uncheck();
  await page.goBack();
  await page.waitForSelector('.overlay', { state: 'detached' });
}

const text = (page, sel) => page.locator(sel).innerText();

// Put drinks straight into the database, then reload. rows: [['2026-11-17T09:15', 500], …]
async function seedDrinks(page, rows) {
  await page.evaluate((rows) => new Promise((resolve, reject) => {
    const req = indexedDB.open('tracker');
    req.onsuccess = () => {
      const tx = req.result.transaction('drinks', 'readwrite');
      rows.forEach(([t, ml], i) => tx.objectStore('drinks').put({ id: 'seed' + i, ts: new Date(t).getTime(), ml }));
      tx.oncomplete = () => { req.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  }), rows);
  await page.reload();
  await page.waitForSelector('#view > *');
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

module.exports = { openApp, addCup, turnOffAsk, seedDrinks, text, assert, eq, ROOT, startServer };
