// Копирует нужные woff2 из @fontsource в public/fonts и генерирует src/styles/fonts.css.
// Запуск: npm run fonts (нужно только при смене шрифтов; результат коммитится).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';

const FONTS = { manrope: [700, 800], inter: [400, 500, 600], 'jetbrains-mono': [400, 600] };
const SUBSETS = ['cyrillic', 'latin', 'latin-ext'];
mkdirSync('public/fonts', { recursive: true });

let css = '/* Сгенерировано scripts/copy-fonts.mjs — не править вручную */\n';
for (const [pkg, weights] of Object.entries(FONTS)) {
  for (const w of weights) {
    const src = readFileSync(`node_modules/@fontsource/${pkg}/${w}.css`, 'utf8');
    for (const block of src.split('/* ').slice(1)) {
      const name = block.slice(0, block.indexOf(' */'));
      const subset = name.replace(`${pkg}-`, '').replace(`-${w}-normal`, '');
      if (!SUBSETS.includes(subset)) continue;
      const file = `${name}.woff2`;
      copyFileSync(`node_modules/@fontsource/${pkg}/files/${file}`, `public/fonts/${file}`);
      const range = block.match(/unicode-range:\s*([^;]+);/)[1];
      const family = block.match(/font-family:\s*'([^']+)'/)[1];
      css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(/fonts/${file}) format('woff2');unicode-range:${range}}\n`;
    }
  }
}
mkdirSync('src/styles', { recursive: true });
writeFileSync('src/styles/fonts.css', css);
console.log('ok');
