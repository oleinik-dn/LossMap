import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://lossmap.pro',
  output: 'static',
  trailingSlash: 'never',
  build: { inlineStylesheets: 'always', format: 'file' },
  compressHTML: true,
  // Скрипты — отдельными файлами (не inline), чтобы CSP обходилась без 'unsafe-inline'.
  vite: { build: { assetsInlineLimit: 0 } },
});
