// Cloudflare Pages Functions - /sitemap.xml 동적 서빙
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const BASE_URL = `${url.protocol}//${url.host}`;
  const TODAY = new Date().toISOString().split('T')[0];

  const urls = [];
  urls.push(`<url><loc>${BASE_URL}/</loc><lastmod>${TODAY}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`);

  for (let year = 1950; year <= 2026; year++) {
    const isMilestone = [1970, 1974, 1980, 1982, 1988, 1990, 1993, 1997, 1998, 2000, 2002, 2010, 2020].includes(year);
    urls.push(`<url><loc>${BASE_URL}/#/${year}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>${isMilestone ? '0.8' : '0.7'}</priority></url>`);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
