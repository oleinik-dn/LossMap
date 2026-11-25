import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://lossmap.pro',
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'always' },
  compressHTML: true,
});
