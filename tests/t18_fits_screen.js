// Update 4: the Today page fits the phone's screen without scrolling, at several heights.
const { openApp, addCup, turnOffAsk, eq, assert } = require('./helpers');
module.exports = async () => {
  const { page, errors, close } = await openApp({ time: '2026-11-22T14:00:00' });
  try {
    await turnOffAsk(page);
    await addCup(page, '1 L', { confirm: false });
    // Redmi installed app / Chrome with bars / small phone / tall phone
    for (const [w, h] of [[393, 851], [393, 760], [393, 700], [360, 640], [412, 915]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => ({
        scroll: document.documentElement.scrollHeight, inner: innerHeight,
        line: document.getElementById('timeline').getBoundingClientRect().height,
        body: document.querySelector('#bigWrap .body').getBoundingClientRect(),
        nav: document.getElementById('nav').getBoundingClientRect().bottom
      }));
      assert(m.scroll <= m.inner + 1, `${w}×${h}: page scrolls (${m.scroll} > ${m.inner})`);
      assert(m.nav <= m.inner + 1, `${w}×${h}: nav bar cut off`);
      assert(m.line >= 170, `${w}×${h}: 24-hour line too short (${m.line})`);
      eq(Math.round(m.body.height), Math.round(m.line - 38), `${w}×${h}: bottle matches the line`);
    }
    // twigs and the pour still line up after resizing
    await page.setViewportSize({ width: 393, height: 700 });
    await addCup(page, '500 ml', { confirm: false });
    eq(await page.locator('#timeline .branch').count(), 2, 'two twigs');
    eq(errors.length, 0, 'no errors: ' + errors.join(' | '));
  } finally { await close(); }
};
