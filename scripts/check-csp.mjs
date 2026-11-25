// Проверка после сборки: у каждого inline-скрипта в dist/*.html хэш должен быть в CSP (deploy/lossmap.caddy).
// JSON-LD (type="application/ld+json") не исполняется и не проверяется.
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const caddy = readFileSync('deploy/lossmap.caddy', 'utf8');
const missing = new Set();
for (const f of readdirSync('dist').filter((n) => n.endsWith('.html'))) {
  const html = readFileSync(`dist/${f}`, 'utf8');
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
    const hash = `sha256-${createHash('sha256').update(m[1]).digest('base64')}`;
    if (!caddy.includes(hash)) missing.add(`${f}: '${hash}'`);
  }
}
if (missing.size) {
  console.error('Inline-скрипты не разрешены CSP. Добавьте хэши в deploy/lossmap.caddy:\n' + [...missing].join('\n'));
  process.exit(1);
}
console.log('CSP: ok');
