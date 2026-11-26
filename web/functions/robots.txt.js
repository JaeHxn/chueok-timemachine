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

User-agent: facebookexternalhit
Allow: /

User-agent: Kakaotalk-scrap
Allow: /

# AI 검색/생성형 엔진 크롤러 개방 (GEO/AEO)
User-agent: GPTBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /

# LLM 안내 파일: https://chueok-timemachine.pages.dev/llms.txt
Sitemap: https://chueok-timemachine.pages.dev/sitemap.xml`;

  return new Response(robots, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
