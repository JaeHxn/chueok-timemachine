// Cloudflare Pages Functions - /robots.txt 서빙
export async function onRequest() {
  const robots = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin
Disallow: /#/admin

User-agent: Googlebot
Allow: /

User-agent: Yeti
Allow: /

User-agent: Daumoa
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: Kakaotalk-scrap
Allow: /

Sitemap: https://chueok-timemachine.pages.dev/sitemap.xml`;

  return new Response(robots, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
