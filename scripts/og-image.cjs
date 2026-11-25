// Рендер public/og-image.png (1200×630) из scripts/og-image.html. Запуск: node scripts/og-image.cjs
const { chromium } = require('playwright');
const path = require('node:path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto('file://' + path.resolve(__dirname, 'og-image.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.resolve(__dirname, '../public/og-image.png') });
  await b.close();
})();
