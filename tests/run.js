// Runs every test file (t01 … tNN) in order. All must pass before an update is packaged.
const fs = require('fs');
const path = require('path');
(async () => {
  const only = process.argv[2];
  const files = fs.readdirSync(__dirname).filter((f) => /^t\d+.*\.js$/.test(f) && (!only || f.includes(only))).sort();
  let failed = 0;
  for (const f of files) {
    const t0 = Date.now();
    try { await require(path.join(__dirname, f))(); console.log(`  ✓ ${f} (${Date.now() - t0} ms)`); }
    catch (e) { failed++; console.log(`  ✗ ${f}\n      ${e.message.split('\n')[0]}`); }
  }
  console.log(failed ? `\n${failed} of ${files.length} failed` : `\nAll ${files.length} passed`);
  process.exit(failed ? 1 : 0);
})();
