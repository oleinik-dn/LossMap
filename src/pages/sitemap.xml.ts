import type { APIRoute } from 'astro';
import site from '../content/ru/site.json';

// Список страниц для поисковиков. Добавить /sr/, когда появится сербская версия.
const pages = ['/', '/privacy'];

export const GET: APIRoute = () => {
  const urls = pages.map((p) => `  <url><loc>${new URL(p, site.seo.siteUrl)}</loc></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
